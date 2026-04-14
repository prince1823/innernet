import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'

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

// Scan back from `cursor` for the most recent `@` in `text` that's not crossed by a newline.
// Returns the char index of the `@`, or -1 if not found. Used by the inline @-query flow in
// handleBlockKeyDown: Cmd/Ctrl+Enter submits everything between this `@` and the cursor.
function findPendingAtOffset(text, cursor) {
  for (let i = cursor - 1; i >= 0; i--) {
    if (text[i] === '\n') return -1
    if (text[i] === '@') return i
  }
  return -1
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
  if (!el) return
  el.focus()
  const sel = window.getSelection()
  if (!sel) return

  // Collect all text-node descendants (single pass)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)

  // Helper: place the caret at the very end of the element's content.
  // Uses the last text node's character length so the anchor is unambiguous —
  // element-level offsets like (span, 1) get re-normalized by the browser in
  // contentEditable, which can snap the caret back to position 0.
  const placeAtEnd = () => {
    const range = document.createRange()
    if (nodes.length > 0) {
      const last = nodes[nodes.length - 1]
      range.setStart(last, last.textContent.length)
    } else {
      range.setStart(el, 0)
    }
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // "End" sentinel
  if (offset === null || offset === undefined || offset === Infinity) {
    placeAtEnd()
    return
  }

  // Finite offset → walk text nodes until we consume it
  let remaining = offset
  for (const node of nodes) {
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

  // Offset past all text → fall through to end
  placeAtEnd()
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

  // Streaming state for AI responses
  // streamingText: blockId → partial text override (takes priority over block.text while streaming)
  const [streamingText, setStreamingText] = useState({})
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

  // Clear focus/zoom + streaming state when date changes
  useEffect(() => {
    setFocusRequest(null)
    setZoomedBlockId(null)
    setStreamingText({})
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
    // The text span lives directly under .ls-block-content for regular blocks,
    // but inside .ls-ai-card for AI blocks — descendant search handles both.
    const blockEl = docBodyRef.current?.querySelector(`[data-block-id="${focusRequest.id}"]`)
    const contentEl = blockEl?.querySelector(':scope > .ls-block-content')
    const el = contentEl?.querySelector('.ls-block-text')
    if (el) setCursorAtOffset(el, focusRequest.offset)
    setFocusRequest(null)
  }, [focusRequest, trees])

  // Keyboard handler — Cmd/Ctrl+Enter (inline @-query submit) / Enter / Tab / Shift+Tab / Backspace
  const handleBlockKeyDown = (e, blockId, block) => {
    const el = e.currentTarget

    // Cmd/Ctrl+Enter submits the inline @-query: scan back from cursor for the
    // most recent @, use everything between it and the cursor as the query, and
    // insert the AI response as a sibling block right after this one. If there's
    // no pending @, fall through so the shortcut isn't swallowed.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (e.nativeEvent?.isComposing) return      // IME safety
      if (block?.isAI) return                     // don't recursively ask from inside an AI answer
      const blockText = el.textContent || ''
      const cursorOffset = getCursorOffset(el)
      const atIdx = findPendingAtOffset(blockText, cursorOffset)
      if (atIdx < 0) return
      const query = blockText.slice(atIdx + 1, cursorOffset).trim()
      if (!query) return
      e.preventDefault()
      const context = blockText.slice(0, atIdx).trim()
      submitInlineAt(blockId, blockText, query, context, cursorOffset)
      return
    }

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
      // Find previous block (visual order) to focus
      const flat = flattenIds(currentTree)
      const idx = flat.indexOf(blockId)
      if (idx <= 0) return // first block — nothing to focus
      const prevId = flat[idx - 1]
      e.preventDefault()

      // flushSync: commit the delete synchronously so the DOM is already
      // updated by the time we restore the cursor. This bypasses the
      // focusRequest/useLayoutEffect round-trip, which was racing with the
      // blur that fires on the unmounting block and sometimes landing the
      // caret at offset 0.
      flushSync(() => {
        applyTreeOp(tree => deleteBlock(tree, blockId))
      })

      // Now directly look up the previous block's text element and place
      // the caret at the end of its rendered text content.
      const prevBlockEl = docBodyRef.current?.querySelector(`[data-block-id="${prevId}"]`)
      const prevContentEl = prevBlockEl?.querySelector(':scope > .ls-block-content')
      const prevTextEl = prevContentEl?.querySelector('.ls-block-text')
      if (prevTextEl) {
        // Use the rendered DOM text length (not the source block.text length)
        // — markdown formatting shrinks the visible text, and we want the
        // caret at the visual end, which is the length of textContent.
        const domLen = (prevTextEl.textContent || '').length
        setCursorAtOffset(prevTextEl, domLen)
      }
    }
  }

  // Blur → persist text edit into tree.
  // Bails when the block is gone (e.g. just removed via Backspace) or when the
  // text hasn't actually changed, so the blur that fires on an unmounting
  // element can't trigger a wasted render that clobbers a just-restored cursor
  // elsewhere on the page.
  const handleBlockBlur = (blockId, text) => {
    setTrees(prev => {
      const current = prev[selectedDate]
      if (!current) return prev
      const ctx = findContext(current, blockId)
      if (!ctx) return prev                 // block no longer exists
      if (ctx.block.text === text) return prev  // no-op edit
      return { ...prev, [selectedDate]: setBlockText(current, blockId, text) }
    })
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

  // Inline @-query submit: user typed `@query` directly into a block's text and pressed
  // Cmd/Ctrl+Enter. The question block keeps its `@query` verbatim; the answer lands as
  // the first child of the question block, styled as an AI card, forming a Q→A visual pair.
  const submitInlineAt = async (blockId, blockText, query, context, cursorOffset) => {
    // 1. Persist the question block text (includes the typed `@query`).
    applyTreeOp(tree => setBlockText(tree, blockId, blockText))

    // 2. Pre-create the empty AI child block so it appears INSTANTLY under the question.
    //    Pre-seeding streamingText[id]='' renders it as an empty AI card with the
    //    existing .ls-block-text-streaming caret — that's our "thinking" affordance.
    const aiBlockId = newBlockId()
    const aiBlock = { id: aiBlockId, text: '', children: [], isAI: true }
    setStreamingText(prev => ({ ...prev, [aiBlockId]: '' }))
    applyTreeOp(tree => prependChildren(tree, blockId, [aiBlock]))

    // 3. Keep focus/cursor in the QUESTION block — the user shouldn't jump to the AI card.
    setFocusRequest({ id: blockId, offset: cursorOffset })

    // 4. Fetch.
    const prompt = `Answer this question: ${query}\n\nContext:\n${context}\n\nRespond as a single flowing paragraph, 2-3 sentences maximum. Be concise and focused. Do NOT use bullet points, numbered lists, or headings — write it as continuous prose.`
    const response = await askAI(prompt, context)
    const paraText = formatAIParagraph(response) || (response || '')

    // 5. Commit the real text to the tree, then stream it in character-by-character.
    applyTreeOp(tree => setBlockText(tree, aiBlockId, paraText))
    await streamBlockText(aiBlockId, paraText)
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
    const showChildren = (hasChildren && !isCollapsed) || blockInserts.length > 0

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
              <span
                className={`ls-block-text ls-block-text-ai ${isStreaming ? 'ls-block-text-streaming' : ''}`}
                contentEditable={!isStreaming}
                suppressContentEditableWarning
                onKeyDown={e => handleBlockKeyDown(e, block.id, block)}
                onBlur={e => handleBlockBlur(block.id, e.currentTarget.textContent)}
                dangerouslySetInnerHTML={{ __html: renderMd(displayText) }}
              />
            </div>
          ) : (
            <span
              className={`ls-block-text ${depth === 0 ? 'ls-heading' : ''} ${isStreaming ? 'ls-block-text-streaming' : ''}`}
              contentEditable={!isStreaming}
              suppressContentEditableWarning
              onKeyDown={e => handleBlockKeyDown(e, block.id, block)}
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
