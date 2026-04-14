import { useState, useRef, useEffect, useCallback } from 'react'

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

const EDITS_KEY = 'innernet-journal-edits'
const AI_INSERTS_KEY = 'innernet-journal-inserts'

function loadEdits() {
  try { return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}') } catch { return {} }
}

function saveEdit(blockId, text) {
  try {
    const edits = loadEdits()
    edits[blockId] = text
    localStorage.setItem(EDITS_KEY, JSON.stringify(edits))
  } catch {}
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

export default function DocumentPanel({ selectedDate, onAskAI, activeAgentFeatures = [] }) {
  const [edits, setEdits] = useState(loadEdits)
  const [atInserts, setAtInserts] = useState(loadAtInserts)
  const docBodyRef = useRef(null)

  // @ mention popup state
  const [atPopup, setAtPopup] = useState(null)
  const [atQuery, setAtQuery] = useState('')
  const [atLoading, setAtLoading] = useState(false)
  const atInputRef = useRef(null)

  const blocks = journalPages[selectedDate] || []

  const updateBlockText = useCallback((blockId, text) => {
    saveEdit(blockId, text)
    setEdits(prev => ({ ...prev, [blockId]: text }))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(AI_INSERTS_KEY, JSON.stringify(atInserts)) } catch {}
  }, [atInserts])

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

  // Dismiss popup when date changes
  useEffect(() => {
    setAtPopup(null)
    setAtQuery('')
    setAtLoading(false)
  }, [selectedDate])

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

  const handleAtSubmit = async (e) => {
    e.preventDefault()
    if (!atQuery.trim() || !atPopup) return

    // Remove the @ from the text node
    if (atPopup.node && atPopup.node.textContent) {
      const t = atPopup.node.textContent
      atPopup.node.textContent = t.slice(0, atPopup.offset - 1) + t.slice(atPopup.offset)
    }

    const blockText = edits[atPopup.blockId] || ''

    setAtLoading(true)
    const prompt = `Answer this question: ${atQuery.trim()}\n\nContext:\n${blockText}`
    const response = await askAI(prompt, blockText)

    const insert = {
      id: `at-${Date.now()}`,
      blockId: atPopup.blockId,
      text: renderMd(response),
    }
    setAtInserts(prev => [...prev, insert])
    setAtPopup(null)
    setAtQuery('')
    setAtLoading(false)
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
    const text = edits[block.id] ?? block.text

    return (
      <div key={block.id} className={`ls-block ${depth === 0 ? 'ls-block-top' : ''}`} data-block-id={block.id}>
        <div className="ls-block-content">
          <div className="ls-bullet-wrap">
            <span className={`ls-bullet ${hasChildren ? 'ls-bullet-parent' : ''}`} />
          </div>
          <span
            className={`ls-block-text ${depth === 0 ? 'ls-heading' : ''}`}
            contentEditable
            suppressContentEditableWarning
            onInput={e => handleInput(e, block.id)}
            onBlur={e => updateBlockText(block.id, e.currentTarget.textContent)}
            dangerouslySetInnerHTML={{ __html: renderMd(text) }}
          />
        </div>

        {(hasChildren || blockInserts.length > 0) && (
          <div className="ls-block-children">
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
            {hasChildren && block.children.map(child => renderBlock(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="doc-panel">
      <div className="doc-body" ref={docBodyRef} style={{ position: 'relative' }}>

        {/* Date heading */}
        <h1 className="ls-page-title">{formatDateHeading(selectedDate || '2026-04-09')}</h1>

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

        {/* Journal blocks */}
        {blocks.length > 0 ? (
          blocks.map(block => renderBlock(block, 0))
        ) : (
          <div className="ls-empty">
            <span className="ls-empty-text">No entries for this date yet</span>
          </div>
        )}
      </div>
    </div>
  )
}
