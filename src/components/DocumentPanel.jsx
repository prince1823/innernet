import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'

import { journalPages } from '../data/sampleData'
import { askAI } from '../utils/askAI'
import './DocumentPanel.css'


function renderMd(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '&bull; $1')
    .replace(/\n/g, '<br/>')
}

const EDITS_KEY = 'innernet-journal-edits'        // legacy — read once for migration
const TREES_KEY = 'innernet-journal-trees'        // per-date editable block trees
const AI_INSERTS_KEY = 'innernet-journal-inserts'

function loadLegacyEdits() {
  try { return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') } catch { return {} }
}

function loadTrees() {
  try { return JSON.parse(localStorage.getItem(TREES_KEY) || '{}') } catch { return {} }
}

function loadAtInserts() {
  try { return JSON.parse(localStorage.getItem(AI_INSERTS_KEY) || '[]') } catch { return [] }
}

function formatDateHeading(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = date.getDate()
  const suffix = [11, 12, 13].includes(day) ? 'th'
    : day % 10 === 1 ? 'st'
    : day % 10 === 2 ? 'nd'
    : day % 10 === 3 ? 'rd' : 'th'
  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`
}

// ── Tree helpers ──────────────────────────────────────────────────────────

function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree))
}

function applyLegacyEdits(tree, edits) {
  for (const b of tree) {
    if (edits[b.id] !== undefined) b.text = edits[b.id]
    if (b.children) applyLegacyEdits(b.children, edits)
  }
  return tree
}

// Materialize a working tree for a date from sample data + any legacy edits
function materializeTree(date, legacyEdits) {
  const sample = cloneTree(journalPages[date] || [])
  return applyLegacyEdits(sample, legacyEdits)
}

// Find block + context (siblings list, index, parent chain) in a tree
function findContext(tree, id) {
  function search(siblings, parentChain) {
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].id === id) {
        return { block: siblings[i], siblings, index: i, parentChain }
      }
      if (siblings[i].children && siblings[i].children.length > 0) {
        const res = search(siblings[i].children, [...parentChain, { siblings, index: i }])
        if (res) return res
      }
    }
    return null
  }
  return search(tree, [])
}

// Flatten tree to an array of block IDs in visual (depth-first) order
function flattenIds(tree, acc = []) {
  for (const b of tree) {
    acc.push(b.id)
    if (b.children && b.children.length > 0) flattenIds(b.children, acc)
  }
  return acc
}

function newBlockId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Tree ops (pure; return new tree) ──────────────────────────────────────

function setBlockText(tree, id, text) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx) return next
  ctx.block.text = text
  return next
}

function insertSiblingAfter(tree, id, newBlock) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx) return next
  ctx.siblings.splice(ctx.index + 1, 0, newBlock)
  return next
}

function indentBlock(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx || ctx.index === 0) return next // no previous sibling → can't indent
  const prev = ctx.siblings[ctx.index - 1]
  if (!prev.children) prev.children = []
  const [removed] = ctx.siblings.splice(ctx.index, 1)
  prev.children.push(removed)
  return next
}

function outdentBlock(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx || ctx.parentChain.length === 0) return next // already at top level
  const parent = ctx.parentChain[ctx.parentChain.length - 1]
  const [removed] = ctx.siblings.splice(ctx.index, 1)
  parent.siblings.splice(parent.index + 1, 0, removed)
  return next
}

function deleteBlock(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx) return next
  ctx.siblings.splice(ctx.index, 1)
  return next
}

function moveBlockUp(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx || ctx.index === 0) return next
  const [removed] = ctx.siblings.splice(ctx.index, 1)
  ctx.siblings.splice(ctx.index - 1, 0, removed)
  return next
}

function moveBlockDown(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx || ctx.index >= ctx.siblings.length - 1) return next
  const [removed] = ctx.siblings.splice(ctx.index, 1)
  ctx.siblings.splice(ctx.index + 1, 0, removed)
  return next
}

function toggleCollapse(tree, id) {
  const next = cloneTree(tree)
  const ctx = findContext(next, id)
  if (!ctx) return next
  ctx.block.collapsed = !ctx.block.collapsed
  return next
}

// Insert new blocks at the beginning of a parent block's children (auto-expands if collapsed)
function prependChildren(tree, parentId, newChildren) {
  const next = cloneTree(tree)
  const ctx = findContext(next, parentId)
  if (!ctx) return next
  if (!ctx.block.children) ctx.block.children = []
  ctx.block.children = [...newChildren, ...ctx.block.children]
  if (ctx.block.collapsed) ctx.block.collapsed = false
  return next
}

// Flatten an AI markdown response into a single-paragraph plain-text string.
// The AI response always lands in one block rendered as flowing prose, so:
//   - List markers (- * + 1. 2. …) and heading markers (# ##) are dropped
//   - Inline markdown (**bold**, *italic*, `code`) is unwrapped to plain text,
//     so round-trip editing via textContent never loses formatting
//   - Lines are joined with a single space to read as one continuous paragraph
function formatAIParagraph(response) {
  if (!response || typeof response !== 'string') return ''
  return response
    .split('\n')
    .map(line => line
      .replace(/^\s*[-*+]\s+/, '')        // leading bullet marker
      .replace(/^\s*\d+[.)]\s+/, '')      // leading numbered marker
      .replace(/^\s*#{1,6}\s+/, '')       // leading heading marker
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → bold
      .replace(/\*([^*]+)\*/g, '$1')      // *italic* → italic
      .replace(/`([^`]+)`/g, '$1')        // `code` → code
      .trim()
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Parse an AI markdown response into a nested tree of blocks.
// (Kept for reference / possible future use — current flow uses formatAIParagraph
// to always return a single paragraph block.)
// - Blank lines are ignored
// - Leading whitespace → nesting depth (2 spaces = 1 level)
// - List markers (- * 1. 2. …) and heading markers (# ##) are stripped
// - Each non-empty line becomes its own block, marked isAI: true
function parseAIResponseToBlocks(response) {
  if (!response || typeof response !== 'string') return []
  const lines = response.split('\n')
  const result = []
  const stack = [{ indent: -1, children: result }]

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const lead = (rawLine.match(/^(\s*)/) || [''])[0].length
    let content = rawLine.slice(lead)
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^#{1,6}\s+/, '')
      .trim()
    if (!content) continue

    const indent = Math.floor(lead / 2)

    // Pop stack to the correct parent for this indent level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const block = { id: newBlockId(), text: content, children: [], isAI: true }
    stack[stack.length - 1].children.push(block)
    stack.push({ indent, children: block.children })
  }

  return result
}

// Returns ancestor blocks from outermost to innermost (not including the target block itself)
function findAncestors(tree, id) {
  const ctx = findContext(tree, id)
  if (!ctx) return []
  return ctx.parentChain.map(p => p.siblings[p.index])
}

// ── Cursor helpers ────────────────────────────────────────────────────────

function getCursorOffset(el) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  if (el !== range.startContainer && !el.contains(range.startContainer)) return 0
  const preRange = document.createRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.startContainer, range.startOffset)
  return preRange.toString().length
}

function setCursorAtOffset(el, offset) {
  el.focus()
  const sel = window.getSelection()
  if (!sel) return

  // "End" sentinel
  if (offset === null || offset === undefined || offset === Infinity) {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    return
  }

  let remaining = offset
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  let node
  while ((node = walker.nextNode())) {
    const len = node.textContent.length
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= len
  }
  // Fallback: place at end (empty element or offset past content)
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

// ──────────────────────────────────────────────────────────────────────────

export default function DocumentPanel({ selectedDate, onAskAI, activeAgentFeatures = [] }) {
  const [trees, setTrees] = useState(loadTrees)
  const [atInserts, setAtInserts] = useState(loadAtInserts)
  // { id, offset } — set after a tree op to restore caret in the target block
  const [focusRequest, setFocusRequest] = useState(null)
  // When set, only render this block (and its subtree) as the page root
  const [zoomedBlockId, setZoomedBlockId] = useState(null)
  const legacyEditsRef = useRef(loadLegacyEdits())
  const docBodyRef = useRef(null)

  // @ mention popup state
  const [atPopup, setAtPopup] = useState(null)
  const [atQuery, setAtQuery] = useState('')
  const [atLoading, setAtLoading] = useState(false)
  const atInputRef = useRef(null)

  // Streaming + loading state for AI responses
  // streamingText: blockId → partial text override (takes priority over block.text while streaming)
  const [streamingText, setStreamingText] = useState({})
  // loadingPlaceholder: { parentId } — render an ephemeral "AI is thinking…" placeholder under this parent
  const [loadingPlaceholder, setLoadingPlaceholder] = useState(null)
  const streamTimersRef = useRef([])

  // Working blocks for current date (saved tree OR materialized from sample)
  const blocks = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)

  // Persist trees
  useEffect(() => {
    try { localStorage.setItem(TREES_KEY, JSON.stringify(trees)) } catch {}
  }, [trees])

  useEffect(() => {
    try { localStorage.setItem(AI_INSERTS_KEY, JSON.stringify(atInserts)) } catch {}
  }, [atInserts])

  // Apply a transformation to the current date's tree (materializes on first op)
  const applyTreeOp = useCallback((fn) => {
    setTrees(prev => {
      const current = prev[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
      return { ...prev, [selectedDate]: fn(current) }
    })
  }, [selectedDate])

  // Force contentEditable on AI insert elements and attach blur save handler
  useEffect(() => {
    if (docBodyRef.current) {
      docBodyRef.current.querySelectorAll('.doc-at-insert-text').forEach(el => {
        el.contentEditable = 'true'
        if (!el.dataset.blurAttached) {
          el.dataset.blurAttached = '1'
          el.addEventListener('blur', () => {
            const id = el.closest('[data-ins-id]')?.dataset?.insId
            if (!id) return
            try {
              const stored = JSON.parse(localStorage.getItem(AI_INSERTS_KEY) || '[]')
              const updated = stored.map(i => i.id === id ? { ...i, text: el.innerHTML } : i)
              localStorage.setItem(AI_INSERTS_KEY, JSON.stringify(updated))
            } catch {}
          })
        }
      })
    }
  })

  // Clear popup/focus/zoom + streaming state when date changes
  useEffect(() => {
    setAtPopup(null)
    setAtQuery('')
    setAtLoading(false)
    setFocusRequest(null)
    setZoomedBlockId(null)
    setStreamingText({})
    setLoadingPlaceholder(null)
    streamTimersRef.current.forEach(t => clearTimeout(t))
    streamTimersRef.current = []
  }, [selectedDate])

  // Clean up any in-flight stream timers when the component unmounts
  useEffect(() => () => {
    streamTimersRef.current.forEach(t => clearTimeout(t))
    streamTimersRef.current = []
  }, [])

  // Restore focus + cursor after tree-modifying operations
  useLayoutEffect(() => {
    if (!focusRequest) return
    const el = docBodyRef.current?.querySelector(
      `[data-block-id="${focusRequest.id}"] > .ls-block-content > .ls-block-text`
    )
    if (el) setCursorAtOffset(el, focusRequest.offset)
    setFocusRequest(null)
  }, [focusRequest, trees])

  // Detect @ typed in any editable field
  const handleInput = (e, blockId) => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const cursorOffset = range.startOffset
    const node = range.startContainer
    const nodeText = node.textContent || ''

    if (cursorOffset > 0 && nodeText[cursorOffset - 1] === '@') {
      const bodyRect = docBodyRef.current.getBoundingClientRect()
      const tempRange = document.createRange()
      tempRange.setStart(node, cursorOffset - 1)
      tempRange.setEnd(node, cursorOffset)
      const rect = tempRange.getBoundingClientRect()

      setAtPopup({
        x: rect.left - bodyRect.left,
        y: rect.bottom - bodyRect.top + docBodyRef.current.scrollTop + 4,
        blockId,
        node,
        offset: cursorOffset,
      })
      setAtQuery('')
      setAtLoading(false)
      setTimeout(() => atInputRef.current?.focus(), 0)
    }
  }

  // Keyboard handler — Enter / Tab / Shift+Tab / Backspace
  const handleBlockKeyDown = (e, blockId) => {
    const el = e.currentTarget

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Split current text at cursor; new block gets the "after" portion
      const cursorOffset = getCursorOffset(el)
      const fullText = el.textContent || ''
      const before = fullText.slice(0, cursorOffset)
      const after = fullText.slice(cursorOffset)
      const newId = newBlockId()
      const newBlock = { id: newId, text: after, children: [] }

      applyTreeOp(tree => {
        const withText = setBlockText(tree, blockId, before)
        return insertSiblingAfter(withText, blockId, newBlock)
      })
      setFocusRequest({ id: newId, offset: 0 })
      return
    }

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const cursorOffset = getCursorOffset(el)
      const currentText = el.textContent || ''
      applyTreeOp(tree => {
        const withText = setBlockText(tree, blockId, currentText)
        return indentBlock(withText, blockId)
      })
      setFocusRequest({ id: blockId, offset: cursorOffset })
      return
    }

    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const cursorOffset = getCursorOffset(el)
      const currentText = el.textContent || ''
      applyTreeOp(tree => {
        const withText = setBlockText(tree, blockId, currentText)
        return outdentBlock(withText, blockId)
      })
      setFocusRequest({ id: blockId, offset: cursorOffset })
      return
    }

    // Alt+↑ / Alt+↓ → move block up/down within its current siblings
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const cursorOffset = getCursorOffset(el)
      const currentText = el.textContent || ''
      const op = e.key === 'ArrowUp' ? moveBlockUp : moveBlockDown
      applyTreeOp(tree => {
        const withText = setBlockText(tree, blockId, currentText)
        return op(withText, blockId)
      })
      setFocusRequest({ id: blockId, offset: cursorOffset })
      return
    }

    if (e.key === 'Backspace') {
      const text = el.textContent || ''
      if (text !== '') return // let default handle character deletion
      // Only delete empty, childless blocks
      const currentTree = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
      const ctx = findContext(currentTree, blockId)
      if (!ctx) return
      if (ctx.block.children && ctx.block.children.length > 0) return
      e.preventDefault()
      // Find previous block (visual order) to focus
      const flat = flattenIds(currentTree)
      const idx = flat.indexOf(blockId)
      const prevId = idx > 0 ? flat[idx - 1] : null
      applyTreeOp(tree => deleteBlock(tree, blockId))
      if (prevId) setFocusRequest({ id: prevId, offset: Infinity })
    }
  }

  // Blur → persist text edit into tree
  const handleBlockBlur = (blockId, text) => {
    applyTreeOp(tree => setBlockText(tree, blockId, text))
  }

  // Toggle collapse state on a block
  const handleToggleCollapse = (blockId, e) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    applyTreeOp(tree => toggleCollapse(tree, blockId))
  }

  // Zoom into a block (click its bullet)
  const handleBulletClick = (blockId, e) => {
    if (e) { e.stopPropagation(); e.preventDefault() }
    setZoomedBlockId(blockId)
  }

  // ── Streaming helpers ────────────────────────────────────────────────────
  // Flatten a block tree depth-first (used to stream nested AI responses in reading order)
  const flattenBlocks = (blockList, acc = []) => {
    for (const b of blockList) {
      acc.push(b)
      if (b.children && b.children.length > 0) flattenBlocks(b.children, acc)
    }
    return acc
  }

  // Animate text into a single block via streamingText state overrides
  const streamBlockText = (blockId, fullText) => new Promise(resolve => {
    const CHARS_PER_TICK = 4
    const TICK_MS = 16
    let i = 0
    const tick = () => {
      i = Math.min(i + CHARS_PER_TICK, fullText.length)
      setStreamingText(prev => ({ ...prev, [blockId]: fullText.slice(0, i) }))
      if (i < fullText.length) {
        const t = setTimeout(tick, TICK_MS)
        streamTimersRef.current.push(t)
      } else {
        // Done — remove the override so block.text takes over on next render
        const t = setTimeout(() => {
          setStreamingText(prev => {
            const next = { ...prev }
            delete next[blockId]
            return next
          })
          resolve()
        }, 40)
        streamTimersRef.current.push(t)
      }
    }
    const t0 = setTimeout(tick, 10)
    streamTimersRef.current.push(t0)
  })

  // Stream a list of blocks sequentially (depth-first)
  const streamBlocksSequentially = async (blocks) => {
    const flat = flattenBlocks(blocks)
    for (const b of flat) {
      await streamBlockText(b.id, b.text || '')
    }
  }

  const handleAtSubmit = async (e) => {
    e.preventDefault()
    if (!atQuery.trim() || !atPopup) return

    const query = atQuery.trim()
    const parentBlockId = atPopup.blockId

    // Inline the query text into the block next to the @ so the block reads "... @query"
    // atPopup.offset is the caret position just after the @ character
    if (atPopup.node && typeof atPopup.node.textContent === 'string') {
      const t = atPopup.node.textContent
      atPopup.node.textContent = t.slice(0, atPopup.offset) + query + t.slice(atPopup.offset)
    }

    // Read the full block's text from the DOM (contentEditable) so we persist
    // the "@query" insertion along with anything else the user typed
    const blockEl = docBodyRef.current?.querySelector(
      `[data-block-id="${parentBlockId}"] > .ls-block-content > .ls-block-text`
    )
    const fullBlockText = blockEl?.textContent || ''

    // Persist the updated parent text and immediately show the loading placeholder
    // under it. Closing the popup first so the user sees the "AI is thinking…" row.
    applyTreeOp(tree => setBlockText(tree, parentBlockId, fullBlockText))
    setLoadingPlaceholder({ parentId: parentBlockId })
    setAtPopup(null)
    setAtQuery('')
    setAtLoading(false)

    const prompt = `Answer this question: ${query}\n\nContext:\n${fullBlockText}\n\nRespond as a single flowing paragraph, 2-3 sentences maximum. Be concise and focused. Do NOT use bullet points, numbered lists, or headings — write it as continuous prose.`
    const response = await askAI(prompt, fullBlockText)

    // AI response always lands as a single paragraph block — flatten any list
    // markers / headings / inline markdown so it reads as clean prose and
    // round-trips cleanly through contentEditable edits.
    const paraText = formatAIParagraph(response) || (response || '')
    const aiBlocks = [{
      id: newBlockId(),
      text: paraText,
      children: [],
      isAI: true,
    }]

    // Pre-seed streamingText so the newly-inserted blocks render empty on first paint,
    // then stream each one character-by-character in reading order.
    const flat = flattenBlocks(aiBlocks)
    setStreamingText(prev => {
      const next = { ...prev }
      for (const b of flat) next[b.id] = ''
      return next
    })
    setLoadingPlaceholder(null)
    applyTreeOp(tree => prependChildren(tree, parentBlockId, aiBlocks))

    await streamBlocksSequentially(aiBlocks)
  }

  const dismissAtPopup = () => {
    setAtPopup(null)
    setAtQuery('')
    setAtLoading(false)
  }

  const removeInsert = (id) => {
    setAtInserts(prev => prev.filter(i => i.id !== id))
  }

  // Recursive block renderer
  const renderBlock = (block, depth = 0) => {
    const hasChildren = block.children && block.children.length > 0
    const blockInserts = atInserts.filter(ins => ins.blockId === block.id)

    const isCollapsed = !!block.collapsed
    const isAI = !!block.isAI
    // Streaming: if this block is currently being typed out, use the partial
    // text override (even when empty) instead of the source-of-truth block.text
    const isStreaming = Object.prototype.hasOwnProperty.call(streamingText, block.id)
    const displayText = isStreaming ? streamingText[block.id] : (block.text || '')
    const hasLoading = loadingPlaceholder?.parentId === block.id
    const showChildren = (hasChildren && !isCollapsed) || blockInserts.length > 0 || hasLoading

    return (
      <div key={block.id} className={`ls-block ${depth === 0 ? 'ls-block-top' : ''} ${isCollapsed ? 'ls-block-collapsed' : ''} ${isAI ? 'ls-block-ai-child' : ''}`} data-block-id={block.id}>
        <div className="ls-block-content">
          <div className="ls-bullet-wrap">
            {hasChildren && (
              <button
                type="button"
                className={`ls-collapse-btn ${isCollapsed ? 'ls-collapse-btn-collapsed' : ''}`}
                onClick={e => handleToggleCollapse(block.id, e)}
                onMouseDown={e => e.preventDefault()}
                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}
            <span
              className={`ls-bullet ${hasChildren ? 'ls-bullet-parent' : ''} ${isAI ? 'ls-bullet-ai' : ''}`}
              onClick={e => handleBulletClick(block.id, e)}
              onMouseDown={e => e.preventDefault()}
              title="Click to zoom in"
            />
          </div>
          {isAI ? (
            <div className="ls-ai-card">
              <span className="ls-ai-prefix" aria-hidden="true">AI</span>
              <span
                className={`ls-block-text ls-block-text-ai ${isStreaming ? 'ls-block-text-streaming' : ''}`}
                contentEditable={!isStreaming}
                suppressContentEditableWarning
                onInput={e => handleInput(e, block.id)}
                onKeyDown={e => handleBlockKeyDown(e, block.id)}
                onBlur={e => handleBlockBlur(block.id, e.currentTarget.textContent)}
                dangerouslySetInnerHTML={{ __html: renderMd(displayText) }}
              />
            </div>
          ) : (
            <span
              className={`ls-block-text ${depth === 0 ? 'ls-heading' : ''} ${isStreaming ? 'ls-block-text-streaming' : ''}`}
              contentEditable={!isStreaming}
              suppressContentEditableWarning
              onInput={e => handleInput(e, block.id)}
              onKeyDown={e => handleBlockKeyDown(e, block.id)}
              onBlur={e => handleBlockBlur(block.id, e.currentTarget.textContent)}
              dangerouslySetInnerHTML={{ __html: renderMd(displayText) }}
            />
          )}
        </div>

        {showChildren && (
          <div className="ls-block-children">
            {/* Clickable thread line — collapses the parent block */}
            {hasChildren && !isCollapsed && (
              <button
                type="button"
                className="ls-thread-line"
                onClick={e => handleToggleCollapse(block.id, e)}
                onMouseDown={e => e.preventDefault()}
                aria-label="Collapse"
                title="Collapse"
                tabIndex={-1}
              />
            )}

            {/* Ephemeral "AI is thinking…" placeholder while request is in flight */}
            {hasLoading && (
              <div className="ls-block ls-block-ai-loading" aria-live="polite">
                <div className="ls-block-content">
                  <div className="ls-bullet-wrap">
                    <span className="ls-bullet ls-bullet-ai ls-bullet-loading" />
                  </div>
                  <div className="ls-ai-card">
                    <span className="ls-ai-prefix" aria-hidden="true">AI</span>
                    <div className="ls-ai-thinking">
                      <span className="ls-ai-thinking-label">thinking</span>
                      <span className="ls-ai-thinking-dots">
                        <span /><span /><span />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI inserts for this block */}
            {blockInserts.map(ins => (
              <div key={ins.id} className="ls-block ls-block-ai" data-ins-id={ins.id}>
                <div className="ls-block-content">
                  <div className="ls-bullet-wrap">
                    <span className="ls-bullet ls-bullet-ai" />
                  </div>
                  <div className="doc-at-insert-text" dangerouslySetInnerHTML={{ __html: ins.text }} />
                </div>
                <button className="doc-at-insert-dismiss" onClick={() => removeInsert(ins.id)} title="Remove">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}

            {/* Child blocks */}
            {hasChildren && !isCollapsed && block.children.map(child => renderBlock(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Determine what to render as page root: either the full date's blocks or a zoomed subtree
  const zoomedBlock = zoomedBlockId ? findContext(blocks, zoomedBlockId)?.block : null
  const rootBlocks = zoomedBlock ? [zoomedBlock] : blocks
  const ancestorTrail = zoomedBlockId ? findAncestors(blocks, zoomedBlockId) : []

  return (
    <div className="doc-panel">
      <div className="doc-body" ref={docBodyRef} style={{ position: 'relative' }}>

        {/* Page heading — date in normal mode, breadcrumb when zoomed into a block */}
        {zoomedBlockId ? (
          <div className="ls-breadcrumb">
            <button type="button" className="ls-breadcrumb-item" onClick={() => setZoomedBlockId(null)}>
              {formatDateHeading(selectedDate || '2026-04-09')}
            </button>
            {ancestorTrail.map(a => (
              <span key={a.id} className="ls-breadcrumb-sep-group">
                <span className="ls-breadcrumb-sep">/</span>
                <button
                  type="button"
                  className="ls-breadcrumb-item"
                  onClick={() => setZoomedBlockId(a.id)}
                  title={a.text}
                >
                  {a.text.length > 32 ? a.text.slice(0, 32) + '…' : a.text}
                </button>
              </span>
            ))}
          </div>
        ) : (
          <h1 className="ls-page-title">{formatDateHeading(selectedDate || '2026-04-09')}</h1>
        )}

        {/* @ mention popup */}
        {atPopup && (
          <div className="at-popup" style={{ left: atPopup.x, top: atPopup.y }}>
            <div className="at-popup-header">
              <span className="at-popup-label">@</span>
              <span className="at-popup-hint">Ask your AI agent</span>
            </div>
            <form className="at-popup-form" onSubmit={handleAtSubmit}>
              <input
                ref={atInputRef}
                className="at-popup-input"
                placeholder="Type your question..."
                value={atQuery}
                onChange={e => setAtQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') dismissAtPopup() }}
                disabled={atLoading}
                autoFocus
              />
              {!atLoading && (
                <button type="submit" className="at-popup-send" disabled={!atQuery.trim()}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              )}
            </form>
            {atLoading && (
              <div className="at-popup-loading">
                <div className="at-loading-dots">
                  <span /><span /><span />
                </div>
                <span className="at-loading-text">Thinking...</span>
              </div>
            )}
          </div>
        )}

        {/* Journal blocks (or zoomed subtree) */}
        {rootBlocks.length > 0 ? (
          rootBlocks.map(block => renderBlock(block, 0))
        ) : (
          <div className="ls-empty">
            <span className="ls-empty-text">No entries for this date yet</span>
          </div>
        )}
      </div>
    </div>
  )
}
