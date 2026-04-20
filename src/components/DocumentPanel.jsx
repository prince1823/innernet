import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'

import { journalPages, calendarTasks } from '../data/sampleData'
import { askAI } from '../utils/askAI'
import './DocumentPanel.css'


function renderMd(text) {
  if (!text) return ''
  // Preserve inline formatting tags persisted by the selection toolbar
  // (b/i/u/s and their semantic equivalents) — everything else gets HTML-escaped
  // before markdown conversion so raw `<` / `>` in user text can't inject markup.
  const ALLOWED_TAG = /<\/?(?:b|i|u|s|strong|em|code|span|br)\b[^>]*>/gi
  const saved = []
  let s = text.replace(ALLOWED_TAG, (m) => {
    saved.push(m)
    return `\x00${saved.length - 1}\x00`
  })
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => saved[parseInt(i, 10)])
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '&bull; $1')
    .replace(/\n/g, '<br/>')
}

// Checks visual emptiness — strips HTML markup (e.g. stray <br>) before trimming,
// since contentEditable persists <br> for cleared-but-focused lines.
function isVisuallyEmpty(s) {
  return !s || !s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

const EDITS_KEY = 'innernet-journal-edits'        // legacy — read once for migration
const TREES_KEY = 'innernet-journal-trees'        // per-date editable block trees
const AI_INSERTS_KEY = 'innernet-journal-inserts'
const STAMP_VERSION_KEY = 'innernet-stamp-version'
const STAMP_VERSION = 2  // bump to force re-stamp
const AI_VIEWS_KEY = 'innernet-journal-ai-views'  // per-date generated AI-enhanced view

function loadAiViews() {
  try { return JSON.parse(localStorage.getItem(AI_VIEWS_KEY) || '{}') } catch { return {} }
}

// djb2 hash — used to invalidate the cached AI view when the source Me tree changes
function hashString(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Strip isAI blocks recursively — Me content is the source of truth for AI generation
function stripAI(tree) {
  return tree
    .filter(b => !b.isAI)
    .map(b => ({ ...b, children: b.children ? stripAI(b.children) : [] }))
}

// Convert a Me tree into a plain-text outline the model can read
function treeToOutline(tree, depth = 0) {
  const indent = '  '.repeat(depth)
  return tree.map(b => {
    const meta = []
    if (b.time) meta.push(b.time)
    if (b.project) meta.push(`#${b.project}`)
    const metaStr = meta.length ? ` [${meta.join(' ')}]` : ''
    const head = `${indent}- ${b.text || ''}${metaStr}`
    const kids = b.children && b.children.length
      ? '\n' + treeToOutline(b.children, depth + 1)
      : ''
    return head + kids
  }).join('\n')
}

// Render markdown for the AI enhanced view — supports ## headings + bullets + inline marks
function renderEnhancedMd(text) {
  if (!text) return ''
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = escaped.split('\n')
  const out = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false }
      continue
    }
    const h2 = line.match(/^##\s+(.+)$/)
    const h1 = line.match(/^#\s+(.+)$/)
    const li = line.match(/^\s*[-*]\s+(.+)$/)
    if (h2) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3 class="ai-doc-h">${inline(h2[1])}</h3>`)
    } else if (h1) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2 class="ai-doc-h">${inline(h1[1])}</h2>`)
    } else if (li) {
      if (!inList) { out.push('<ul class="ai-doc-ul">'); inList = true }
      out.push(`<li>${inline(li[1])}</li>`)
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<p class="ai-doc-p">${inline(line)}</p>`)
    }
  }
  if (inList) out.push('</ul>')
  return out.join('')

  function inline(s) {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  }
}

// Flatten all user (non-AI) blocks to a list of { id, text, time, project }
// for source-lens lookups from the AI enhanced view
function flattenMeBlocks(tree, acc = []) {
  for (const b of tree) {
    if (!b.isAI) acc.push({ id: b.id, text: b.text, time: b.time, project: b.project })
    if (b.children && b.children.length) flattenMeBlocks(b.children, acc)
  }
  return acc
}

const STOPWORDS = new Set(['the','a','an','of','to','and','or','but','in','on','at','for','with','is','was','are','were','be','been','being','by','this','that','these','those','it','its','as','from','we','our','i','me','my','you','your','he','she','they','them','their','has','have','had','do','does','did','will','would','can','could','may','might','must','should','not'])

function tokenize(s) {
  return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

// Word-overlap similarity: returns up to topN Me-block IDs whose tokens share
// the most with the bullet text. Dead-simple — the model won't tell us the
// provenance, so we reconstruct it heuristically.
function findSources(bulletText, meBlocks, topN = 3) {
  const bTokens = tokenize(bulletText)
  if (!bTokens.length) return []
  const bSet = new Set(bTokens)
  const scored = []
  for (const b of meBlocks) {
    const tokens = tokenize(b.text)
    if (!tokens.length) continue
    let shared = 0
    for (const t of tokens) if (bSet.has(t)) shared++
    if (shared > 0) scored.push({ id: b.id, score: shared })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN).map(x => x.id)
}

// Parse the model's markdown output into a structured Doc: an array of blocks
// where headings/paragraphs are plain text and bullet lists carry per-item
// `sources` arrays. Doc is what we actually persist and render from.
function parseMarkdownToDoc(md, meBlocks) {
  const lines = (md || '').split('\n')
  const doc = []
  let currentUl = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { currentUl = null; continue }
    const h2 = line.match(/^##\s+(.+)$/)
    const h1 = line.match(/^#\s+(.+)$/)
    const li = line.match(/^[-*]\s+(.+)$/)
    if (h2 || h1) {
      currentUl = null
      doc.push({ type: 'h', level: h2 ? 3 : 2, text: (h2 || h1)[1] })
    } else if (li) {
      if (!currentUl) { currentUl = { type: 'ul', items: [] }; doc.push(currentUl) }
      currentUl.items.push({ text: li[1], sources: findSources(li[1], meBlocks) })
    } else {
      currentUl = null
      doc.push({ type: 'p', text: line })
    }
  }
  return doc
}

// Walk the tree and collect Q&A pairs: each AI block with a sourceQuery yields
// one pair (question, answer, top-level ancestor text/time). Used to inject
// highlighted callouts into the AI enhanced view under the matching section.
function collectQAPairs(tree) {
  const pairs = []
  function walk(nodes, topBlock, parentBlock) {
    for (const b of nodes) {
      const nextTop = topBlock || b
      if (b.isAI && b.sourceQuery) {
        pairs.push({
          id: b.id,
          topId: nextTop.id,
          question: b.sourceQuery,
          answer: (b.text || '').trim(),
          topText: nextTop.text || '',
          topTime: nextTop.time,
          askedOn: (parentBlock?.text || '').trim(),
          askedOnId: parentBlock?.id || null,
          askedAt: b.askedAt || null,
        })
      }
      if (b.children && b.children.length) walk(b.children, topBlock || b, b)
    }
  }
  walk(tree, null, null)
  return pairs
}

// Match each Q&A pair to the most relevant heading section in the Doc by word
// overlap between the pair's top-level ancestor text and the heading text,
// then append a callout item to that section's UL.
function injectCalloutsIntoDoc(doc, pairs) {
  if (!pairs.length) return doc
  const next = doc.map(b => b.type === 'ul' ? { ...b, items: [...b.items] } : b)
  const sections = []
  for (let i = 0; i < next.length; i++) {
    if (next[i].type === 'h') {
      for (let j = i + 1; j < next.length; j++) {
        if (next[j].type === 'h') break
        if (next[j].type === 'ul') { sections.push({ ulIdx: j, headingText: next[i].text }); break }
      }
    }
  }
  for (const pair of pairs) {
    const topTokens = new Set(tokenize(pair.topText))
    let best = null, bestScore = 0
    for (const sec of sections) {
      let score = 0
      for (const t of tokenize(sec.headingText)) if (topTokens.has(t)) score++
      if (score > bestScore) { bestScore = score; best = sec }
    }
    const target = best || sections[0]
    if (!target) continue
    next[target.ulIdx].items.push({
      text: pair.answer,
      kind: 'callout',
      question: pair.question,
      askedOn: pair.askedOn,
      sources: [],
      sourceTopId: pair.topId,
    })
  }
  return next
}

// Render Doc back to markdown (used for hash/diagnostics; not for display)
function docToMarkdown(doc) {
  if (!doc) return ''
  const out = []
  for (const b of doc) {
    if (b.type === 'h') out.push(`${'#'.repeat(b.level)} ${b.text}`)
    else if (b.type === 'p') out.push(b.text)
    else if (b.type === 'ul') for (const it of b.items) out.push(`- ${it.text}`)
  }
  return out.join('\n')
}

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

  // Finite offset → walk text nodes until we consume it. We also observe the
  // element for any subsequent content mutation (e.g. a React re-render that
  // replaces innerHTML via dangerouslySetInnerHTML) and re-apply the caret —
  // contentEditable loses the caret when its child text nodes are swapped.
  const place = () => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    const ns = []
    let m
    while ((m = w.nextNode())) ns.push(m)
    let rem = offset
    for (const node of ns) {
      const len = node.textContent.length
      if (rem <= len) {
        const range = document.createRange()
        range.setStart(node, rem)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        return true
      }
      rem -= len
    }
    return false
  }
  if (place()) {
    // Watch for a re-render that would wipe the caret and re-apply once.
    const obs = new MutationObserver(() => {
      place()
      obs.disconnect()
    })
    obs.observe(el, { childList: true, characterData: true, subtree: true })
    setTimeout(() => obs.disconnect(), 200)
    return
  }
  // fallback: walk text nodes (mirrors old behavior)
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

// Floating formatting toolbar that follows the user's text selection inside `containerRef`.
// Kept as a separate component with its own state so selection-tracking re-renders
// don't cascade into the parent editor (re-rendering contentEditable blocks can
// wipe the active selection).
function SelectionToolbar({ containerRef, onImprove, showImprove }) {
  const [pos, setPos] = useState(null)
  const [improveOpen, setImproveOpen] = useState(false)
  const [toneOpen, setToneOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const captureRef = useRef(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); setImproveOpen(false); setToneOpen(false); return }
      const range = sel.getRangeAt(0)
      const anchor = range.commonAncestorContainer
      const anchorEl = anchor.nodeType === 1 ? anchor : anchor.parentElement
      const container = containerRef.current
      if (!container || !anchorEl || !container.contains(anchorEl)) { setPos(null); setImproveOpen(false); setToneOpen(false); return }
      const rect = range.getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) { setPos(null); setImproveOpen(false); setToneOpen(false); return }
      setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 })
    }
    const onMouseDown = (e) => {
      if (e.target.closest && e.target.closest('.doc-sel-toolbar')) return
      setPos(null); setImproveOpen(false); setToneOpen(false)
    }
    const onMouseUp = (e) => {
      if (e.target?.closest && e.target.closest('.doc-sel-toolbar')) return
      setTimeout(update, 0)
    }
    const onKeyUp = () => { update() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keyup', onKeyUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keyup', onKeyUp)
    }
  }, [containerRef])

  const applyFormat = (cmd) => {
    try {
      document.execCommand('styleWithCSS', false, false)
      document.execCommand(cmd)
    } catch {}
  }

  const captureSelection = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
    const text = sel.toString()
    if (!text.trim()) return null
    const range = sel.getRangeAt(0).cloneRange()
    const anchorEl = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
    const editableEl = anchorEl?.closest?.('[contenteditable="true"]')
    if (!editableEl) return null
    return { text, range, editableEl }
  }

  const runImprove = async (action, tone) => {
    const cap = captureRef.current || captureSelection()
    if (!cap) { setImproveOpen(false); setToneOpen(false); return }
    setBusy(true)
    try {
      await onImprove(cap, action, tone)
    } finally {
      setBusy(false)
      setImproveOpen(false)
      setToneOpen(false)
      setPos(null)
      captureRef.current = null
    }
  }

  const openImprove = () => {
    captureRef.current = captureSelection()
    setImproveOpen(v => !v)
    setToneOpen(false)
  }

  if (!pos) return null
  return (
    <div
      className="doc-sel-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.preventDefault()}
    >
      {showImprove && (
        <div className="doc-sel-improve-wrap">
          <button
            type="button"
            className={`doc-sel-btn doc-sel-improve-btn ${busy ? 'busy' : ''}`}
            onClick={openImprove}
            title="Improve with AI"
            disabled={busy}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
              <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/>
            </svg>
            {busy ? 'Improving…' : 'Improve'}
          </button>
          {improveOpen && !busy && (
            <div className="doc-sel-menu" onMouseDown={e => e.preventDefault()}>
              <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('simplify')}>Simplify text</button>
              <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('reduce')}>Reduce text</button>
              <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('detailed')}>Make it detailed</button>
              <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('summarize')}>Summarize</button>
              <div className="doc-sel-menu-sub">
                <button type="button" className="doc-sel-menu-item" onClick={() => setToneOpen(v => !v)}>
                  Adjust tone <span style={{ marginLeft: 'auto', opacity: 0.5 }}>›</span>
                </button>
                {toneOpen && (
                  <div className="doc-sel-submenu">
                    <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('tone', 'professional')}>Professional</button>
                    <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('tone', 'casual')}>Casual</button>
                    <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('tone', 'friendly')}>Friendly</button>
                    <button type="button" className="doc-sel-menu-item" onClick={() => runImprove('tone', 'confident')}>Confident</button>
                  </div>
                )}
              </div>
            </div>
          )}
          <span className="doc-sel-sep" />
        </div>
      )}
      <button type="button" className="doc-sel-btn" onClick={() => applyFormat('bold')} title="Bold"><b>B</b></button>
      <button type="button" className="doc-sel-btn" onClick={() => applyFormat('italic')} title="Italic"><i>I</i></button>
      <button type="button" className="doc-sel-btn" onClick={() => applyFormat('underline')} title="Underline"><u>U</u></button>
      <button type="button" className="doc-sel-btn" onClick={() => applyFormat('strikeThrough')} title="Strikethrough"><s>S</s></button>
    </div>
  )
}

export default function DocumentPanel({ selectedDate, onAskAI, activeAgentFeatures = [] }) {
  const [trees, setTrees] = useState(loadTrees)
  const [atInserts, setAtInserts] = useState(loadAtInserts)
  // { id, offset } — set after a tree op to restore caret in the target block
  const [focusRequest, setFocusRequest] = useState(null)
  // When set, only render this block (and its subtree) as the page root
  const [zoomedBlockId, setZoomedBlockId] = useState(null)
  // Granola-style notes view toggle: 'me' = human-typed only, 'ai' = AI-enhanced included
  const [notesMode, setNotesMode] = useState('me')
  // When set, highlight the AI callout tied to this top-level block id (cleared after 3s)
  const [highlightCalloutAiId, setHighlightCalloutAiId] = useState(null)
  // When set, flash-highlight a Me-mode block by id (cleared after 2s)
  const [highlightMeBlockId, setHighlightMeBlockId] = useState(null)
  // Track per-callout regeneration state by AI block id
  const [regeneratingCalloutIds, setRegeneratingCalloutIds] = useState(new Set())
  // Generated AI-enhanced view per date: { [date]: { sourceHash, content, generatedAt } }
  const [aiViews, setAiViews] = useState(loadAiViews)
  const [aiViewLoading, setAiViewLoading] = useState(false)
  const [aiViewError, setAiViewError] = useState(null)
  // Streaming overlay for the enhanced view: partial markdown shown in place of cached doc while typing in
  const [aiViewStream, setAiViewStream] = useState(null)
  // Which bullet's source popover is open: { sectionIdx, itemIdx } or null
  const [openSourceLens, setOpenSourceLens] = useState(null)
  // Token of the in-flight generation; used so an old fetch doesn't overwrite a newer one
  const aiGenTokenRef = useRef(0)
  const aiStreamTimersRef = useRef([])
  const legacyEditsRef = useRef(loadLegacyEdits())
  const docBodyRef = useRef(null)

  // Streaming state for AI responses
  // streamingText: blockId → partial text override (takes priority over block.text while streaming)
  const [streamingText, setStreamingText] = useState({})
  const streamTimersRef = useRef([])

  // Working blocks for current date (saved tree OR materialized from sample)
  const blocks = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)

  // Auto-stamp time/project on top-level blocks by matching to calendar events
  useEffect(() => {
    if (!blocks.length) return
    const events = calendarTasks[selectedDate] || []
    if (!events.length) return

    const savedVersion = parseInt(localStorage.getItem(STAMP_VERSION_KEY) || '0', 10)
    const forceRestamp = savedVersion < STAMP_VERSION
    const eventTimes = new Set(events.map(e => e.time))
    const needsStamp = forceRestamp || blocks.some(b => !b.time || !eventTimes.has(b.time))
    if (!needsStamp) return

    // Match block text to event title by word overlap
    function matchScore(blockText, eventTitle) {
      const bWords = (blockText || '').toLowerCase().split(/\s+/)
      const eWords = (eventTitle || '').toLowerCase().split(/\s+/)
      return bWords.filter(w => w.length > 2 && eWords.some(ew => ew.includes(w) || w.includes(ew))).length
    }

    setTrees(prev => {
      const current = prev[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
      const usedEvents = new Set()
      const stamped = current.map(b => {
        if (!forceRestamp && b.time && eventTimes.has(b.time)) return b
        let bestEv = null, bestScore = 0
        for (const ev of events) {
          if (usedEvents.has(ev.id)) continue
          const score = matchScore(b.text, ev.title)
          if (score > bestScore) { bestScore = score; bestEv = ev }
        }
        if (!bestEv) bestEv = events.find(ev => !usedEvents.has(ev.id))
        if (bestEv) {
          usedEvents.add(bestEv.id)
          return { ...b, time: bestEv.time, project: b.project || bestEv.project }
        }
        return b
      })
      return { ...prev, [selectedDate]: stamped }
    })
    localStorage.setItem(STAMP_VERSION_KEY, String(STAMP_VERSION))
  }, [selectedDate])

  // Persist trees
  useEffect(() => {
    try { localStorage.setItem(TREES_KEY, JSON.stringify(trees)) } catch {}
  }, [trees])

  useEffect(() => {
    try { localStorage.setItem(AI_INSERTS_KEY, JSON.stringify(atInserts)) } catch {}
  }, [atInserts])

  useEffect(() => {
    try { localStorage.setItem(AI_VIEWS_KEY, JSON.stringify(aiViews)) } catch {}
  }, [aiViews])

  // Generate (or reuse cached) enhanced view when entering AI mode for a date.
  // Cache key is the hash of the stripped Me tree — edits invalidate automatically.
  const generateAiView = useCallback(async (force = false) => {
    const stripped = stripAI(blocks || [])
    if (!stripped.length) {
      setAiViewError('No notes to enhance yet — write something in Me mode first.')
      return
    }
    const outline = treeToOutline(stripped)
    const sourceHash = hashString(outline)

    if (!force) {
      const cached = aiViews[selectedDate]
      if (cached && cached.sourceHash === sourceHash) return
    }

    const myToken = ++aiGenTokenRef.current
    setAiViewLoading(true)
    setAiViewError(null)

    const prompt = `Rewrite these raw journal notes into a polished, well-structured daily summary in markdown. ` +
      `Use ## headings to group related entries by topic or project. Use bullets and short paragraphs. ` +
      `Improve grammar, expand cryptic shorthand into full sentences, and dedupe overlap. ` +
      `Do NOT include question/answer artifacts — write as continuous prose. Do NOT invent facts. ` +
      `Output markdown only, no preamble.\n\nRaw notes:\n${outline}`

    try {
      const response = await askAI(prompt, '')
      if (myToken !== aiGenTokenRef.current) return // superseded
      const fullText = response || ''

      // Stream the enhanced doc in character-by-character
      aiStreamTimersRef.current.forEach(t => clearTimeout(t))
      aiStreamTimersRef.current = []
      const CHARS_PER_TICK = 12
      const TICK_MS = 16
      let i = 0
      setAiViewStream('')
      await new Promise(resolve => {
        const tick = () => {
          if (myToken !== aiGenTokenRef.current) return resolve()
          i = Math.min(i + CHARS_PER_TICK, fullText.length)
          setAiViewStream(fullText.slice(0, i))
          if (i < fullText.length) {
            const t = setTimeout(tick, TICK_MS)
            aiStreamTimersRef.current.push(t)
          } else {
            resolve()
          }
        }
        const t0 = setTimeout(tick, 10)
        aiStreamTimersRef.current.push(t0)
      })
      if (myToken !== aiGenTokenRef.current) return

      // Parse markdown into structured Doc + attach per-bullet source-lens mapping,
      // then inject Q&A pairs as highlighted callouts under their matching sections.
      const meBlocks = flattenMeBlocks(stripped)
      const qaPairs = collectQAPairs(blocks || [])
      const doc = injectCalloutsIntoDoc(parseMarkdownToDoc(fullText, meBlocks), qaPairs)

      setAiViews(prev => ({
        ...prev,
        [selectedDate]: {
          sourceHash,
          doc,
          generatedAt: Date.now(),
        },
      }))
      setAiViewStream(null)
    } catch (e) {
      if (myToken !== aiGenTokenRef.current) return
      setAiViewError('Failed to generate AI view.')
    } finally {
      if (myToken === aiGenTokenRef.current) setAiViewLoading(false)
    }
  }, [aiViews, blocks, selectedDate])

  useEffect(() => () => {
    aiStreamTimersRef.current.forEach(t => clearTimeout(t))
    aiStreamTimersRef.current = []
  }, [])

  // AI view is derived purely from user Q&A pairs — no full-content regeneration.
  // Each question/answer the user asked in Me mode becomes a callout in AI mode,
  // grouped under its top-level ancestor heading. No API call on mode flip.

  useEffect(() => { setOpenSourceLens(null) }, [notesMode, selectedDate])

  // Close the source lens popover on outside-click
  useEffect(() => {
    if (!openSourceLens) return
    const onDocClick = (e) => {
      if (e.target.closest('.ai-doc-sources') || e.target.closest('.ai-doc-lens')) return
      setOpenSourceLens(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openSourceLens])

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

      // Check for inline @-query first
      const atIdx = findPendingAtOffset(blockText, cursorOffset)
      if (atIdx >= 0) {
        const query = blockText.slice(atIdx + 1, cursorOffset).trim()
        if (query) {
          e.preventDefault()
          const context = blockText.slice(0, atIdx).trim()
          submitInlineAt(blockId, blockText, query, context, atIdx)
          return
        }
      }

      // Cmd+Enter with #hashtag — commit as project tag and remove from text
      const tagMatch = blockText.match(/#(\w+)/)
      if (tagMatch) {
        e.preventDefault()
        const project = tagMatch[1]
        const cleanText = blockText.replace(/#\w+/, '').trim()
        applyTreeOp(tree => {
          const next = setBlockText(tree, blockId, cleanText)
          const ctx = findContext(next, blockId)
          if (ctx) ctx.block.project = project
          return next
        })
        return
      }
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

      // If the current block is top-level, stamp the new sibling with the current time
      const currentTree = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
      const ctx = findContext(currentTree, blockId)
      if (ctx && ctx.parentChain.length === 0) {
        const now = new Date()
        const hh = now.getHours().toString().padStart(2, '0')
        const mm = now.getMinutes().toString().padStart(2, '0')
        newBlock.time = `${hh}:${mm}`
      }

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

    // ArrowUp / ArrowDown → move caret to previous / next block when the caret
    // is on the first / last visual line of the current block. Wrapped multi-line
    // blocks still let the browser handle intra-block line navigation naturally.
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0)
        const caretRect = range.getClientRects()[0] || range.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
        // Single-line blocks: always treat caret as both first and last line.
        const isSingleLine = elRect.height < lineHeight * 1.5
        const caretTop = caretRect && caretRect.height ? caretRect.top : elRect.top
        const caretBottom = caretRect && caretRect.height ? caretRect.bottom : elRect.top + lineHeight
        const atFirstLine = isSingleLine || (caretTop - elRect.top < lineHeight * 0.75)
        const atLastLine = isSingleLine || (elRect.bottom - caretBottom < lineHeight * 0.75)
        const shouldJump = (e.key === 'ArrowUp' && atFirstLine) || (e.key === 'ArrowDown' && atLastLine)
        if (shouldJump) {
          // Walk the visible DOM (not the tree) so we skip blocks hidden by the
          // current mode (AI children in Me mode) or collapsed ancestors.
          const container = docBodyRef.current
          if (container) {
            const visible = [...container.querySelectorAll('[data-block-id] > .ls-block-content .ls-block-text')]
            const idx = visible.indexOf(el)
            const target = e.key === 'ArrowUp' ? visible[idx - 1] : visible[idx + 1]
            if (target) {
              e.preventDefault()
              const domLen = (target.textContent || '').length
              const offset = e.key === 'ArrowUp' ? domLen : 0
              target.focus()
              setCursorAtOffset(target, offset)
              requestAnimationFrame(() => setCursorAtOffset(target, offset))
              return
            }
          }
        }
      }
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
        // Force a real focus cycle so the browser paints a visible blinking
        // caret — programmatic focus right after an unmount sometimes lands
        // the selection correctly but suppresses the caret until next click.
        prevTextEl.blur()
        prevTextEl.focus()
        setCursorAtOffset(prevTextEl, domLen)
        requestAnimationFrame(() => setCursorAtOffset(prevTextEl, domLen))
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
  const submitInlineAt = async (blockId, blockText, query, context, atIdx) => {
    // 1. Persist the question block text (includes the typed `@query`).
    applyTreeOp(tree => setBlockText(tree, blockId, blockText))

    // 2. Pre-create the empty AI child block so it appears INSTANTLY under the question.
    //    Pre-seeding streamingText[id]='' renders it as an empty AI card with the
    //    existing .ls-block-text-streaming caret — that's our "thinking" affordance.
    //    sourceQuery / sourceContext are stashed on the block now so the "Implement"
    //    CTA (added after streaming finishes) can spawn a session with full context.
    const aiBlockId = newBlockId()
    const aiBlock = {
      id: aiBlockId,
      text: '',
      children: [],
      isAI: true,
      sourceQuery: query,
      sourceContext: context,
      askedAt: Date.now(),
    }
    setStreamingText(prev => ({ ...prev, [aiBlockId]: '' }))
    applyTreeOp(tree => prependChildren(tree, blockId, [aiBlock]))

    // 3. Keep focus/cursor in the QUESTION block — place it where the `@` was typed,
    //    so the user can continue composing at that spot after the card appears.
    setFocusRequest({ id: blockId, offset: atIdx })

    // 4. Fetch.
    const prompt = `Answer this question: ${query}\n\nContext:\n${context}\n\nRespond as a single flowing paragraph, 2-3 sentences maximum. Be concise and focused. Do NOT use bullet points, numbered lists, or headings — write it as continuous prose.`
    const response = await askAI(prompt, context)
    const paraText = formatAIParagraph(response) || (response || '')

    // 5. Commit the real text to the tree, then stream it in character-by-character.
    applyTreeOp(tree => setBlockText(tree, aiBlockId, paraText))
    await streamBlockText(aiBlockId, paraText)

    // 6. Strip the `@query` from the parent block text — the question is preserved on
    //    the AI child as sourceQuery for the AI-mode callout, so Me mode reads cleanly.
    //    Also flip on the Implement CTA now that the card is a complete Q→A.
    //    Compute the stripped result + cursor target ahead of the state update so we
    //    can schedule setFocusRequest synchronously (state updaters run async in React).
    const target = '@' + query
    const idx = (blockText || '').lastIndexOf(target)
    let hashTagProject = null
    let restoredCursor = null
    if (idx >= 0) {
      const leftPart = blockText.slice(0, idx)
      const rightPart = blockText.slice(idx + target.length)
      let dehashedLeft = leftPart
      let dehashedRight = rightPart
      const hashMatch = (leftPart + rightPart).match(/#(\w+)/)
      if (hashMatch) {
        hashTagProject = hashMatch[1]
        dehashedLeft = leftPart.replace(/#\w+/, '')
        dehashedRight = dehashedLeft === leftPart
          ? rightPart.replace(/#\w+/, '')
          : rightPart
      }
      const stripped = (dehashedLeft + dehashedRight).replace(/\s+/g, ' ').trim()
      const leftCollapsed = dehashedLeft.replace(/\s+/g, ' ').replace(/^\s+/, '')
      restoredCursor = Math.min(leftCollapsed.trimEnd().length, stripped.length)
    }
    applyTreeOp(tree => {
      const next = cloneTree(tree)
      const parentCtx = findContext(next, blockId)
      if (parentCtx) {
        const current = parentCtx.block.text || ''
        const tgt = '@' + query
        const j = current.lastIndexOf(tgt)
        if (j >= 0) {
          const leftPart = current.slice(0, j)
          const rightPart = current.slice(j + tgt.length)
          let dehashedLeft = leftPart
          let dehashedRight = rightPart
          if (hashTagProject && !parentCtx.block.project) {
            parentCtx.block.project = hashTagProject
            dehashedLeft = leftPart.replace(/#\w+/, '')
            dehashedRight = dehashedLeft === leftPart
              ? rightPart.replace(/#\w+/, '')
              : rightPart
          }
          parentCtx.block.text = (dehashedLeft + dehashedRight).replace(/\s+/g, ' ').trim()
        }
      }
      const aiCtx = findContext(next, aiBlockId)
      if (aiCtx) aiCtx.block.canImplement = true
      return next
    })
    if (restoredCursor !== null) {
      setFocusRequest({ id: blockId, offset: restoredCursor })
    }
  }

  // Regenerate a single AI callout by re-running its original query with its stored context.
  // Only touches that one AI block's text — no global rewrite, no other callouts change.
  const regenerateCallout = useCallback(async (aiBlockId) => {
    const currentTree = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
    const ctx = findContext(currentTree, aiBlockId)
    if (!ctx) return
    const block = ctx.block
    const query = (block.sourceQuery || '').trim()
    if (!query) return
    const context = block.sourceContext || ''

    setRegeneratingCalloutIds(prev => { const next = new Set(prev); next.add(aiBlockId); return next })
    try {
      const prompt = `Answer this question: ${query}\n\nContext:\n${context}\n\nRespond as a single flowing paragraph, 2-3 sentences maximum. Be concise and focused. Do NOT use bullet points, numbered lists, or headings — write it as continuous prose.`
      const response = await askAI(prompt, context)
      const paraText = formatAIParagraph(response) || (response || '')
      applyTreeOp(tree => setBlockText(tree, aiBlockId, paraText))
      applyTreeOp(tree => {
        const next = cloneTree(tree)
        const c = findContext(next, aiBlockId)
        if (c) c.block.askedAt = Date.now()
        return next
      })
      await streamBlockText(aiBlockId, paraText)
    } catch (e) {
      // swallow — leaves existing text intact
    } finally {
      setRegeneratingCalloutIds(prev => { const next = new Set(prev); next.delete(aiBlockId); return next })
    }
  }, [trees, selectedDate, askAI])

  // Selection-driven "Improve" rewrite: take the user's highlighted substring,
  // ask the AI to transform it per the chosen action, and splice the rewrite
  // back into the contentEditable element. Works across Me mode (tree-backed)
  // and AI mode (doc-node-backed) because we edit the DOM and then fire blur
  // so each mode's existing onBlur persists the change through its own path.
  const handleImproveSelection = useCallback(async ({ text: selectedText, range, editableEl }, action, tone) => {
    if (!editableEl || !selectedText) return

    const formatRule = 'Respond in plain prose only. Do NOT use any markdown: no **bold**, no *italics*, no headings, no bullet points, no numbered lists, no code fences. Return continuous sentences.'
    const instruction = {
      simplify: `Rewrite this text in simpler language. Keep the original meaning. ${formatRule} Return only the rewritten text — no preamble, no quotes.`,
      reduce: `Shorten this text while preserving key information. ${formatRule} Return only the shortened text — no preamble, no quotes.`,
      detailed: `Expand this text with more detail, examples, and nuance. Keep the original intent. ${formatRule} Return only the expanded text — no preamble, no quotes.`,
      summarize: `Summarize this text into one or two concise sentences. ${formatRule} Return only the summary — no preamble, no quotes.`,
      tone: `Rewrite this text in a ${tone || 'professional'} tone. Keep the meaning. ${formatRule} Return only the rewritten text — no preamble, no quotes.`,
    }[action] || `Improve this text. ${formatRule} Return only the rewritten text.`
    // Pass the full block text as context so the AI understands tone/topic,
    // but only rewrite the selected substring. Mark the selection with
    // [[SELECTED: … ]] so the model knows which span to transform.
    const fullText = (editableEl.textContent || '').trim()
    const contextBlock = fullText && fullText !== selectedText
      ? `Surrounding paragraph (for context only — do not rewrite the whole thing):\n${fullText}\n\n`
      : ''
    const prompt = `${instruction}\n\n${contextBlock}Selected text to rewrite:\n${selectedText}`

    const stripMarkdown = (s) => (s || '')
      .replace(/```[\s\S]*?```/g, '')         // fenced code
      .replace(/`([^`]+)`/g, '$1')            // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold
      .replace(/__([^_]+)__/g, '$1')          // bold alt
      .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')// italic
      .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')  // italic alt
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')     // headings
      .replace(/^\s*[-*+]\s+/gm, '')          // bullets
      .replace(/^\s*\d+\.\s+/gm, '')          // numbered
      .replace(/\n{2,}/g, ' ')                // collapse blank lines
      .replace(/\s+/g, ' ')                   // normalize whitespace
      .trim()

    try {
      const response = await askAI(prompt, '')
      const rewritten = stripMarkdown(response).replace(/^["'`]+|["'`]+$/g, '')
      if (!rewritten) return
      // Splice via the saved Range (the live selection may have collapsed when
      // the user clicked a menu button). Falls back to text-replace when the
      // Range's nodes aren't in the DOM anymore (e.g. React re-rendered).
      try {
        if (editableEl.contains(range.startContainer) && editableEl.contains(range.endContainer)) {
          range.deleteContents()
          range.insertNode(document.createTextNode(rewritten))
          editableEl.normalize()
        } else {
          const curr = editableEl.textContent || ''
          const idx = curr.indexOf(selectedText)
          if (idx < 0) return
          editableEl.textContent = curr.slice(0, idx) + rewritten + curr.slice(idx + selectedText.length)
        }
      } catch {
        const curr = editableEl.textContent || ''
        const idx = curr.indexOf(selectedText)
        if (idx < 0) return
        editableEl.textContent = curr.slice(0, idx) + rewritten + curr.slice(idx + selectedText.length)
      }
      // Fire input + blur so each mode's existing handlers persist the change.
      editableEl.dispatchEvent(new Event('input', { bubbles: true }))
      editableEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    } catch {
      // swallow — leave content unchanged on failure
    }
  }, [])

  // ── Implement CTA handlers ─────────────────────────────────────────────
  // The CTA lives inside each @-query AI card. "Yes" spawns a ChatWindows
  // feature session seeded with the original question + AI answer + the text
  // that was sitting above the `@` as surrounding context; "No" just flips
  // implementStatus so the footer disappears.
  const handleAcceptImplement = useCallback((aiBlockId) => {
    const currentTree = trees[selectedDate] || materializeTree(selectedDate, legacyEditsRef.current)
    const ctx = findContext(currentTree, aiBlockId)
    if (!ctx) return
    const block = ctx.block

    const query = (block.sourceQuery || '').trim() || 'Ad-hoc feature'
    const title = query.length > 50 ? query.slice(0, 50) + '…' : query
    const sessionContext = [
      block.sourceContext ? `Surrounding context:\n${block.sourceContext}` : '',
      `Original question:\n${query}`,
      `Initial AI answer:\n${block.text || ''}`,
    ].filter(Boolean).join('\n\n')
    const featId = `adhoc-${aiBlockId}`

    if (onAskAI) onAskAI(featId, title, sessionContext)

    applyTreeOp(tree => {
      const next = cloneTree(tree)
      const ctxIn = findContext(next, aiBlockId)
      if (!ctxIn) return next
      ctxIn.block.implementStatus = 'accepted'
      ctxIn.block.sessionId = featId
      return next
    })
  }, [trees, selectedDate, onAskAI, applyTreeOp])

  const handleDeclineImplement = useCallback((aiBlockId) => {
    applyTreeOp(tree => {
      const next = cloneTree(tree)
      const ctx = findContext(next, aiBlockId)
      if (!ctx) return next
      ctx.block.implementStatus = 'declined'
      return next
    })
  }, [applyTreeOp])

  const removeInsert = (id) => {
    setAtInserts(prev => prev.filter(i => i.id !== id))
  }

  // Recursive block renderer
  const renderBlock = (block, depth = 0) => {
    const rawChildren = block.children || []
    // In Me mode we hide AI children entirely — the answer belongs in AI mode.
    // Instead we flag the line with a small "AI answered" marker so the user
    // knows something was generated from this block.
    const hideAI = notesMode === 'me'
    const aiChildren = hideAI ? rawChildren.filter(c => c.isAI && !isVisuallyEmpty(c.text)) : []
    const aiGeneratingChild = hideAI
      ? rawChildren.find(c => c.isAI && Object.prototype.hasOwnProperty.call(streamingText, c.id))
      : null
    const isAIGenerating = !!aiGeneratingChild
    const hasAIMarker = hideAI && aiChildren.length > 0
    const mainChildren = hideAI ? rawChildren.filter(c => !c.isAI) : rawChildren
    const hasChildren = mainChildren.length > 0
    const blockInserts = atInserts.filter(ins => ins.blockId === block.id)

    const isCollapsed = !!block.collapsed
    const isAI = !!block.isAI
    // Streaming: if this block is currently being typed out, use the partial
    // text override (even when empty) instead of the source-of-truth block.text
    const isStreaming = Object.prototype.hasOwnProperty.call(streamingText, block.id)
    const rawText = isStreaming ? streamingText[block.id] : (block.text || '')
    const hasVisibleText = !isVisuallyEmpty(rawText)
    // Extract inline #hashtags to show as project tags on the right (keep in text until Cmd+Enter commits)
    const inlineTagMatch = rawText.match(/#(\w+)/)
    const inlineProject = inlineTagMatch ? inlineTagMatch[1] : null
    // In Me mode, hide any `@query` from display — it's preserved on the AI child
    // as sourceQuery, so the AI-mode callout still shows it as provenance.
    const displayText = (hideAI && (hasAIMarker || isAIGenerating))
      ? rawText.replace(/@[^\n]*/g, '').replace(/\s+/g, ' ').trim()
      : rawText
    const effectiveProject = block.project || inlineProject
    const showChildren = (hasChildren && !isCollapsed) || blockInserts.length > 0

    return (
      <div key={block.id} className={`ls-block ${depth === 0 ? 'ls-block-top' : ''} ${isCollapsed ? 'ls-block-collapsed' : ''} ${isAI ? 'ls-block-ai-child' : ''} ${highlightMeBlockId === block.id ? 'ls-block-highlight' : ''}`} data-block-id={block.id}>
        <div className={`ls-block-content ${(hasAIMarker || isAIGenerating) ? 'ls-block-content-has-ai' : ''}`}>
          {/* Time on top-level headings — before the bullet */}
          {depth === 0 && block.time && (
            <span className="ls-block-time">{(() => {
              const [h, m] = block.time.split(':').map(Number)
              const ampm = h >= 12 ? 'PM' : 'AM'
              const h12 = h % 12 || 12
              return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
            })()}</span>
          )}
          {(isAI ? hasVisibleText : true) && (
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
          )}
          {isAI ? (
            <div className="ls-ai-card">
              <span
                className={`ls-block-text ls-block-text-ai ${isStreaming ? 'ls-block-text-streaming' : ''}`}
                contentEditable={!isStreaming}
                suppressContentEditableWarning
                onKeyDown={e => handleBlockKeyDown(e, block.id, block)}
                onBlur={e => handleBlockBlur(block.id, e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: renderMd(displayText) }}
              />
              {block.canImplement && !block.implementStatus && !isStreaming && (
                <div className="ls-ai-card-footer">
                  <span className="ls-ai-card-cta">Want me to start a session to implement this?</span>
                  <div className="ls-ai-card-actions">
                    <button
                      type="button"
                      className="ls-ai-card-btn ls-ai-card-btn-yes"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleAcceptImplement(block.id)}
                    >Yes</button>
                    <button
                      type="button"
                      className="ls-ai-card-btn ls-ai-card-btn-no"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleDeclineImplement(block.id)}
                    >No</button>
                  </div>
                </div>
              )}
              {block.implementStatus === 'accepted' && (
                <div className="ls-ai-card-footer ls-ai-card-footer-status">
                  <span className="ls-ai-card-status">Session started → see windows above</span>
                </div>
              )}
            </div>
          ) : (
            <span
              className={`ls-block-text ${depth === 0 ? 'ls-heading' : ''} ${isStreaming ? 'ls-block-text-streaming' : ''}`}
              contentEditable={!isStreaming}
              suppressContentEditableWarning
              onKeyDown={e => handleBlockKeyDown(e, block.id, block)}
              onBlur={e => handleBlockBlur(block.id, e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: renderMd(displayText) }}
            />
          )}
          {isAIGenerating && hasVisibleText && (
            <span className="ls-ai-generating" aria-live="polite">
              <span className="ls-ai-generating-dots" aria-hidden="true">
                <span /><span /><span />
              </span>
              <span className="ls-ai-generating-text">generating in AI mode</span>
            </span>
          )}
          {hasAIMarker && !isAIGenerating && hasVisibleText && (
            <button
              type="button"
              className="ls-ai-marker"
              onClick={() => {
                // Highlight only the specific AI answer tied to this block
                const aiId = aiChildren[0]?.id
                if (!aiId) return
                setNotesMode('ai')
                setHighlightCalloutAiId(aiId)
                setTimeout(() => setHighlightCalloutAiId(curr => (curr === aiId ? null : curr)), 3000)
              }}
              onMouseDown={e => e.preventDefault()}
              title="AI added an insight — view in AI mode"
              aria-label="View AI insight"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
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
            {hasChildren && !isCollapsed && mainChildren.map(child => renderBlock(child, depth + 1))}
          </div>
        )}

      </div>
    )
  }

  // Determine what to render as page root: either the full date's blocks or a zoomed subtree
  const zoomedBlock = zoomedBlockId ? findContext(blocks, zoomedBlockId)?.block : null
  const baseRoot = zoomedBlock ? [zoomedBlock] : blocks
  const ancestorTrail = zoomedBlockId ? findAncestors(blocks, zoomedBlockId) : []

  // Me mode keeps the full tree — renderBlock decides per-block whether AI children
  // are surfaced as marginalia (depth 0) or still rendered inline (deeper). AI mode
  // never reaches renderBlock; it goes through the enhanced-view render path instead.
  const rootBlocks = baseRoot

  // Stale detection: compare current Me-tree hash against cached AI view's source hash
  const cachedAiView = aiViews[selectedDate]
  const liveSourceHash = notesMode === 'ai'
    ? hashString(treeToOutline(stripAI(blocks || [])))
    : null
  const isStale = !!cachedAiView && liveSourceHash && cachedAiView.sourceHash !== liveSourceHash && !aiViewLoading

  // Me-block lookup map — used by the source-lens popover to show raw notes by id
  const meBlockList = notesMode === 'ai' ? flattenMeBlocks(stripAI(blocks || [])) : []
  const meBlockById = notesMode === 'ai'
    ? meBlockList.reduce((acc, b) => (acc[b.id] = b, acc), {})
    : {}

  // Persist a text edit to a specific doc node (bullet or heading/para).
  // coord is { block: idx } for headings/paras, { block: idx, item: j } for bullets.
  const updateDocNodeText = (coord, newText) => {
    setAiViews(prev => {
      const cur = prev[selectedDate]
      if (!cur) return prev
      // Always work off the current displayDoc's shape (so we handle the legacy-migration case)
      const baseDoc = cur.doc
        || (cur.content ? parseMarkdownToDoc(cur.content, meBlockList) : [])
      const next = baseDoc.map((b, i) => {
        if (i !== coord.block) return b
        if (b.type === 'ul' && typeof coord.item === 'number') {
          const items = b.items.map((it, j) => j === coord.item ? { ...it, text: newText } : it)
          return { ...b, items }
        }
        return { ...b, text: newText }
      })
      return {
        ...prev,
        [selectedDate]: { ...cur, doc: next, content: undefined, edited: true, generatedAt: Date.now() },
      }
    })
  }

  // Build the AI view directly from user Q&A pairs — no content regeneration.
  // Each new question appended in Me mode shows up here as an additional callout
  // under the same top-level heading, without touching any existing responses.
  let displayDoc = null
  {
    const pairs = collectQAPairs(blocks || [])
    if (pairs.length > 0) {
      const byTop = new Map()
      for (const p of pairs) {
        if (!(p.answer || '').trim()) continue
        if (!byTop.has(p.topId)) byTop.set(p.topId, { topText: p.topText, items: [] })
        byTop.get(p.topId).items.push({
          kind: 'callout',
          text: p.answer,
          question: p.question,
          askedOn: p.askedOn,
          askedOnId: p.askedOnId,
          askedAt: p.askedAt,
          sourceTopId: p.topId,
          aiBlockId: p.id,
          sources: [],
        })
      }
      const doc = []
      for (const { topText, items } of byTop.values()) {
        if (!items.length) continue
        doc.push({ type: 'h', level: 3, text: topText })
        doc.push({ type: 'ul', items })
      }
      displayDoc = doc
    }
  }

  return (
    <div className="doc-panel">
      <SelectionToolbar containerRef={docBodyRef} showImprove={notesMode === 'ai'} onImprove={handleImproveSelection} />
      <div className="doc-body" ref={docBodyRef} style={{ position: 'relative' }}>

        {/* Granola-style Me / AI notes toggle */}
        <div className="doc-mode-toggle">
          <button
            type="button"
            className={`doc-mode-btn ${notesMode === 'me' ? 'active' : ''}`}
            onClick={() => setNotesMode('me')}
            title="Show only your notes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            Me
          </button>
          <button
            type="button"
            className={`doc-mode-btn ${notesMode === 'ai' ? 'active' : ''}`}
            onClick={() => setNotesMode('ai')}
            title="Show AI-enhanced notes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            AI
          </button>
        </div>

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

        {/* AI-enhanced view (read-only) when in AI mode */}
        {notesMode === 'ai' ? (
          <div className="ai-doc">
            {aiViewError && <div className="ai-doc-error">{aiViewError}</div>}
            {aiViewLoading && !displayDoc ? (
              <div className="ai-doc-loading">
                <span className="ai-doc-shimmer" />
                <span className="ai-doc-shimmer" style={{ width: '80%' }} />
                <span className="ai-doc-shimmer" style={{ width: '60%' }} />
              </div>
            ) : displayDoc && displayDoc.length > 0 ? (
              (() => {
                // Filter doc to only show callouts (Q&A insights) under their section headings.
                // Drop AI-rewritten bullets/paragraphs so the user sees only what they asked.
                const filteredDoc = []
                for (let i = 0; i < displayDoc.length; i++) {
                  const b = displayDoc[i]
                  if (b.type === 'h') {
                    let hasCalloutInSection = false
                    for (let j = i + 1; j < displayDoc.length; j++) {
                      if (displayDoc[j].type === 'h') break
                      if (displayDoc[j].type === 'ul' && displayDoc[j].items.some(it => it.kind === 'callout')) {
                        hasCalloutInSection = true
                        break
                      }
                    }
                    if (hasCalloutInSection) filteredDoc.push(b)
                  } else if (b.type === 'ul') {
                    const calloutItems = b.items.filter(it => it.kind === 'callout')
                    if (calloutItems.length > 0) filteredDoc.push({ ...b, items: calloutItems, __origIdx: i })
                  }
                }
                const sourceDoc = filteredDoc.length > 0 ? filteredDoc : displayDoc
                return (
              <div className={`ai-doc-body ${aiViewStream !== null ? 'ai-doc-body-streaming' : ''}`}>
                {sourceDoc.map((block, bi) => {
                  const editable = aiViewStream === null && !aiViewLoading
                  if (block.type === 'h') {
                    const Tag = block.level === 2 ? 'h2' : 'h3'
                    return (
                      <Tag
                        key={bi}
                        className="ai-doc-h"
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={e => {
                          const t = e.currentTarget.textContent || ''
                          if (t !== block.text) updateDocNodeText({ block: bi }, t)
                        }}
                      >{block.text}</Tag>
                    )
                  }
                  if (block.type === 'p') {
                    return (
                      <p
                        key={bi}
                        className="ai-doc-p"
                        contentEditable={editable}
                        suppressContentEditableWarning
                        onBlur={e => {
                          const t = e.currentTarget.textContent || ''
                          if (t !== block.text) updateDocNodeText({ block: bi }, t)
                        }}
                      >{block.text}</p>
                    )
                  }
                  if (block.type === 'ul') {
                    return (
                      <ul key={bi} className="ai-doc-ul">
                        {block.items.map((item, ii) => {
                          const isOpen = openSourceLens && openSourceLens.block === bi && openSourceLens.item === ii
                          const sources = (item.sources || []).map(id => meBlockById[id]).filter(Boolean)
                          if (item.kind === 'callout') {
                            const isHighlighted = highlightCalloutAiId && item.aiBlockId === highlightCalloutAiId
                            return (
                              <li
                                key={ii}
                                className={`ai-doc-callout ${isHighlighted ? 'ai-doc-callout-highlight' : ''}`}
                                contentEditable={false}
                                ref={isHighlighted ? (el => el && el.scrollIntoView({ behavior: 'smooth', block: 'center' })) : undefined}
                              >
                                <span className="ai-doc-callout-glyph" aria-hidden>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z"/></svg>
                                </span>
                                <span className="ai-doc-callout-body">
                                  <span
                                    className="ai-doc-callout-answer"
                                    contentEditable={editable}
                                    suppressContentEditableWarning
                                    onKeyDown={e => {
                                      if ((e.key === 'Backspace' || e.key === 'Delete') && item.aiBlockId) {
                                        const t = e.currentTarget.textContent || ''
                                        if (!t.trim()) {
                                          e.preventDefault()
                                          applyTreeOp(tree => deleteBlock(tree, item.aiBlockId))
                                        }
                                      }
                                    }}
                                    onInput={e => {
                                      const t = e.currentTarget.textContent || ''
                                      if (!t.trim() && item.aiBlockId) {
                                        applyTreeOp(tree => deleteBlock(tree, item.aiBlockId))
                                      }
                                    }}
                                    onBlur={e => {
                                      const t = e.currentTarget.textContent || ''
                                      if (t !== item.text) {
                                        if (!t.trim() && item.aiBlockId) {
                                          applyTreeOp(tree => deleteBlock(tree, item.aiBlockId))
                                          return
                                        }
                                        updateDocNodeText({ block: bi, item: ii }, t)
                                        if (item.aiBlockId) {
                                          applyTreeOp(tree => setBlockText(tree, item.aiBlockId, t))
                                        }
                                      }
                                    }}
                                  >{item.text}</span>
                                  {item.question && (item.text || '').trim() && (
                                    <span className="ai-doc-callout-from">
                                      from: {item.question}
                                      {item.askedOn && (() => {
                                        const full = item.askedOn
                                        const shown = full.length > 60 ? full.slice(0, 60).trimEnd() + '…' : full
                                        return item.askedOnId ? (
                                          <button
                                            type="button"
                                            className="ai-doc-callout-on ai-doc-callout-on-clickable"
                                            onClick={() => {
                                              const id = item.askedOnId
                                              setNotesMode('me')
                                              setHighlightMeBlockId(id)
                                              setTimeout(() => {
                                                const el = document.querySelector(`[data-block-id="${id}"]`)
                                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                              }, 40)
                                              setTimeout(() => setHighlightMeBlockId(curr => (curr === id ? null : curr)), 2000)
                                            }}
                                            onMouseDown={e => e.preventDefault()}
                                            title={full.length > 60 ? full : 'Jump to this note in Me mode'}
                                          > on “{shown}”</button>
                                        ) : (
                                          <span className="ai-doc-callout-on" title={full.length > 60 ? full : undefined}> on “{shown}”</span>
                                        )
                                      })()}
                                      {item.askedAt && (
                                        <span className="ai-doc-callout-stamp" title={new Date(item.askedAt).toLocaleString()}>
                                          {new Date(item.askedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                          <span className="ai-doc-callout-stamp-dot">·</span>
                                          {new Date(item.askedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>
                                {item.aiBlockId && (
                                  <button
                                    type="button"
                                    className={`ai-doc-callout-regen ${regeneratingCalloutIds.has(item.aiBlockId) ? 'is-regenerating' : ''}`}
                                    onClick={() => regenerateCallout(item.aiBlockId)}
                                    onMouseDown={e => e.preventDefault()}
                                    disabled={regeneratingCalloutIds.has(item.aiBlockId)}
                                    title="Regenerate this response"
                                    aria-label="Regenerate response"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="23 4 23 10 17 10"/>
                                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                    </svg>
                                  </button>
                                )}
                              </li>
                            )
                          }
                          return (
                            <li key={ii} className="ai-doc-li">
                              <span className="ai-doc-li-row">
                                <span
                                  className="ai-doc-li-text"
                                  contentEditable={editable}
                                  suppressContentEditableWarning
                                  onBlur={e => {
                                    const t = e.currentTarget.textContent || ''
                                    if (t !== item.text) updateDocNodeText({ block: bi, item: ii }, t)
                                  }}
                                >{item.text}</span>
                                {sources.length > 0 && (
                                  <button
                                    type="button"
                                    contentEditable={false}
                                    className={`ai-doc-lens ${isOpen ? 'active' : ''}`}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => setOpenSourceLens(isOpen ? null : { block: bi, item: ii })}
                                    title="Show source notes"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="11" cy="11" r="7"/>
                                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    </svg>
                                  </button>
                                )}
                              </span>
                              {isOpen && sources.length > 0 && (
                                <div className="ai-doc-sources" contentEditable={false}>
                                  <div className="ai-doc-source-text">
                                    {sources
                                      .map(s => (s.text || '').trim())
                                      .filter(Boolean)
                                      .map(t => /[.!?]$/.test(t) ? t : t + '.')
                                      .join(' ')}
                                  </div>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )
                  }
                  return null
                })}
              </div>
                )
              })()
            ) : !aiViewError && (
              <div className="ls-empty"><span className="ls-empty-text">Switch to Me mode to add notes, then come back.</span></div>
            )}
          </div>
        ) : rootBlocks.length > 0 ? (
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
