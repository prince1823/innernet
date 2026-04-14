import { useState, useRef, useEffect, useCallback } from 'react'

import { featureDocItems } from '../data/sampleData'
import { askAI } from '../utils/askAI'
import './DocumentPanel.css'


function renderMd(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<strong style="display:block;margin:4px 0 2px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin:4px 0 2px">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/\n/g, '<br/>')
}

const STORAGE_KEY = 'innernet-doc-edits'
const AI_INSERTS_KEY = 'innernet-at-inserts'

function loadFeatures() {
  const base = featureDocItems.map(f => ({
    ...f,
    bullets: f.bullets.map(b => typeof b === 'string' ? { text: b } : { ...b }),
  }))
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return base.map(f => {
      const s = saved[f.id]
      if (!s) return f
      return {
        ...f,
        title: s.title ?? f.title,
        description: s.description ?? f.description,
        bullets: f.bullets.map((b, i) => ({ ...b, text: s.bullets?.[i] ?? b.text })),
      }
    })
  } catch { return base }
}

function saveFeature(featId, field, value) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (!saved[featId]) saved[featId] = {}
    if (field === 'title' || field === 'description') {
      saved[featId][field] = value
    } else if (field.startsWith('bullet-')) {
      const idx = parseInt(field.replace('bullet-', ''))
      if (!saved[featId].bullets) saved[featId].bullets = {}
      saved[featId].bullets[idx] = value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {}
}

function loadAtInserts() {
  try { return JSON.parse(localStorage.getItem(AI_INSERTS_KEY) || '[]') } catch { return [] }
}

export default function DocumentPanel({ onAskAI, activeAgentFeatures = [] }) {
  const [features, setFeatures] = useState(loadFeatures)
  const [editingKey, setEditingKey] = useState(null)
  const [atInserts, setAtInserts] = useState(loadAtInserts) // { id, featId, bulletIdx, text }
  const docBodyRef = useRef(null)

  // @ mention popup state
  const [atPopup, setAtPopup] = useState(null) // { x, y, featId, bulletIdx, field, node, offset }
  const [atQuery, setAtQuery] = useState('')
  const [atLoading, setAtLoading] = useState(false)
  const atInputRef = useRef(null)

  const updateField = (featId, field, value) => {
    saveFeature(featId, field, value)
    setFeatures(prev => prev.map(f => {
      if (f.id !== featId) return f
      if (field === 'title') return { ...f, title: value }
      if (field === 'description') return { ...f, description: value }
      if (field.startsWith('bullet-')) {
        const idx = parseInt(field.replace('bullet-', ''))
        const bullets = f.bullets.map((b, i) => i === idx ? { ...b, text: value } : b)
        return { ...f, bullets }
      }
      return f
    }))
  }

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
            const id = el.parentElement?.dataset?.insId
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

  // Save edited insert text — update state (for persistence) without resetting DOM
  const saveInsertText = useCallback((id, newHtml) => {
    setAtInserts(prev => prev.map(i => i.id === id ? { ...i, text: newHtml } : i))
  }, [])

  // Detect @ typed in any editable field
  const handleInput = (e, featId, bulletIdx, field) => {
    const el = e.currentTarget
    const text = el.textContent || ''
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    // Check if the character just before cursor is @
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
        featId,
        bulletIdx,
        field,
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

    const feat = features.find(f => f.id === atPopup.featId)
    const featTitle = feat?.title || ''
    const context = feat ? [
      feat.description || '',
      ...feat.bullets.map(b => `- ${b.text}`),
    ].filter(Boolean).join('\n') : ''

    setAtLoading(true)
    const prompt = `For the feature "${featTitle}", answer this: ${atQuery.trim()}\n\nContext:\n${context}`
    const response = await askAI(prompt, context)

    const insert = {
      id: `at-${Date.now()}`,
      featId: atPopup.featId,
      bulletIdx: atPopup.bulletIdx,
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

  return (
    <div className="doc-panel">
      <div className="doc-panel-header">
        <span className="doc-panel-title">Plan Window</span>
      </div>
      <div className="doc-body" ref={docBodyRef} style={{ position: 'relative' }}>

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

        {features.map((feat) => {
          return (
            <div key={feat.id} className="doc-feature" data-feat-id={feat.id}>
              {/* Feature title */}
              <div className="doc-feat-title">
                <span
                  className="doc-feat-title-text"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => handleInput(e, feat.id, null, 'title')}
                  onBlur={e => { updateField(feat.id, 'title', e.currentTarget.textContent); setEditingKey(null) }}
                >
                  {feat.title}
                </span>
              </div>

              {/* AI inserts for title level */}
              {atInserts
                .filter(ins => ins.featId === feat.id && ins.bulletIdx === null)
                .map(ins => (
                  <div key={ins.id} className="doc-at-insert" data-ins-id={ins.id}>
                    <div
                      className="doc-at-insert-text"
                      dangerouslySetInnerHTML={{ __html: ins.text }}
                    />
                    <button className="doc-at-insert-dismiss" onClick={() => removeInsert(ins.id)} title="Remove">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))
              }

              {/* Description */}
              {feat.description && (
                <p
                  className="doc-feat-desc"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => handleInput(e, feat.id, null, 'description')}
                  onBlur={e => { updateField(feat.id, 'description', e.currentTarget.textContent); setEditingKey(null) }}
                  dangerouslySetInnerHTML={{ __html: renderMd(feat.description) }}
                />
              )}

              {/* Bullets */}
              <div className="doc-bullets">
                {feat.bullets.map((bullet, bi) => (
                  <div key={bi} className="doc-bullet-block" data-feat-id={feat.id} data-bullet-idx={bi}>
                    <div className="doc-bullet-row">
                      <span className="doc-bullet-marker">•</span>
                      <span
                        className="doc-bullet-text"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={e => handleInput(e, feat.id, bi, `bullet-${bi}`)}
                        onBlur={e => { updateField(feat.id, `bullet-${bi}`, e.currentTarget.textContent); setEditingKey(null) }}
                        dangerouslySetInnerHTML={{ __html: renderMd(bullet.text) }}
                      />
                    </div>

                    {/* AI inserts for this bullet */}
                    {atInserts
                      .filter(ins => ins.featId === feat.id && ins.bulletIdx === bi)
                      .map(ins => (
                        <div key={ins.id} className="doc-at-insert" data-ins-id={ins.id}>
                          <div className="doc-at-insert-text" dangerouslySetInnerHTML={{ __html: ins.text }} />
                          <button className="doc-at-insert-dismiss" onClick={() => removeInsert(ins.id)} title="Remove">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))
                    }
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
