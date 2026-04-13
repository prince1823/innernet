import { useState, useRef, useEffect } from 'react'
import { featureDocItems } from '../data/sampleData'
import { askAI } from '../utils/askAI'
import './DocumentPanel.css'

function AiIcon({ size = 12 }) {
  // 4-pointed star path helper: big at center, small top-right, tiny bottom-right
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* Large sparkle */}
      <path d="M9 2 C9 2 9.8 6.5 11 8 C12.2 9.5 17 10 17 10 C17 10 12.2 10.5 11 12 C9.8 13.5 9 18 9 18 C9 18 8.2 13.5 7 12 C5.8 10.5 1 10 1 10 C1 10 5.8 9.5 7 8 C8.2 6.5 9 2 9 2Z" />
      {/* Small sparkle top-right */}
      <path d="M18 2 C18 2 18.4 4.2 19 5 C19.6 5.8 22 6 22 6 C22 6 19.6 6.2 19 7 C18.4 7.8 18 10 18 10 C18 10 17.6 7.8 17 7 C16.4 6.2 14 6 14 6 C14 6 16.4 5.8 17 5 C17.6 4.2 18 2 18 2Z" />
      {/* Tiny sparkle bottom-right */}
      <path d="M18 14 C18 14 18.3 15.5 18.8 16.2 C19.3 16.9 21 17 21 17 C21 17 19.3 17.1 18.8 17.8 C18.3 18.5 18 20 18 20 C18 20 17.7 18.5 17.2 17.8 C16.7 17.1 15 17 15 17 C15 17 16.7 16.9 17.2 16.2 C17.7 15.5 18 14 18 14Z" />
    </svg>
  )
}

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

const QUICK_ACTIONS = [
  { label: 'Improve writing', prompt: (t) => `Improve the writing of this text, keep it concise: "${t}"` },
  { label: 'Make shorter',    prompt: (t) => `Make this shorter while keeping the meaning: "${t}"` },
  { label: 'Simplify',        prompt: (t) => `Simplify the language of this text: "${t}"` },
  { label: 'Proofread',       prompt: (t) => `Proofread and fix any errors in: "${t}"` },
]

const STORAGE_KEY = 'innernet-doc-edits'

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

export default function DocumentPanel({ onAskAI, activeAgentFeatures = [] }) {
  const [features, setFeatures] = useState(loadFeatures)
  const [aiResponses, setAiResponses] = useState({}) // key: "featId-bulletIdx" or "featId-title"
  const [loadingKeys, setLoadingKeys] = useState(new Set())
  const [editingKey, setEditingKey] = useState(null) // which field is in edit mode
  const [selInserts, setSelInserts] = useState([]) // { id, featId, bulletIdx, text }

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

  // Selection popup
  const [selPopup, setSelPopup] = useState(null) // { x, y, text }
  const [selLoading, setSelLoading] = useState(false)
  const [selResponse, setSelResponse] = useState(null) // { original, suggestion }
  const [selInput, setSelInput] = useState('')
  const docBodyRef = useRef(null)
  const savedRangeRef = useRef(null) // save selection range before clicks clear it

  useEffect(() => {
    const handleMouseUp = (e) => {
      if (e.target.closest('.sel-popup')) return // don't reset when clicking inside popup
      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim()
        if (!text || text.length < 3) { setSelPopup(null); return }
        if (!docBodyRef.current?.contains(sel.anchorNode)) return
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const bodyRect = docBodyRef.current.getBoundingClientRect()
        savedRangeRef.current = range.cloneRange()

        // Capture feat/bullet position now, before any re-renders detach the nodes
        let featId = null, bulletIdx = null
        let el = sel.anchorNode
        if (el && el.nodeType === 3) el = el.parentElement
        while (el && el !== docBodyRef.current) {
          if (el.dataset?.featId) { featId = el.dataset.featId; bulletIdx = parseInt(el.dataset.bulletIdx ?? '-1'); break }
          el = el.parentElement
        }

        setSelPopup({
          x: rect.left - bodyRect.left + rect.width / 2,
          y: rect.top - bodyRect.top - 8 + docBodyRef.current.scrollTop,
          text,
          featId,
          bulletIdx,
        })
        setSelResponse(null)
        setSelInput('')
      }, 10)
    }
    const handleMouseDown = (e) => {
      if (!e.target.closest('.sel-popup')) {
        setSelPopup(null)
        setSelResponse(null)
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  const handleSelAction = async (promptFn) => {
    if (!selPopup) return
    setSelLoading(true)
    setSelResponse(null)
    const response = await askAI(promptFn(selPopup.text), selPopup.text)
    setSelResponse({ original: selPopup.text, suggestion: response })
    setSelLoading(false)
  }

  const handleSelCustom = async (e) => {
    e.preventDefault()
    if (!selInput.trim() || !selPopup) return
    setSelLoading(true)
    setSelResponse(null)
    const response = await askAI(`${selInput.trim()} — for this text: "${selPopup.text}"`, selPopup.text)
    setSelResponse({ original: selPopup.text, suggestion: response })
    setSelLoading(false)
    setSelInput('')
  }

  const handleSelAccept = () => {
    if (savedRangeRef.current && selResponse) {
      try {
        const range = savedRangeRef.current
        range.deleteContents()
        range.insertNode(document.createTextNode(selResponse.suggestion))
        window.getSelection()?.removeAllRanges()
        savedRangeRef.current = null
      } catch {}
    }
    setSelPopup(null); setSelResponse(null)
  }

  const handleSelInsertBelow = () => {
    if (selResponse && selPopup?.featId && selPopup.bulletIdx >= 0) {
      setSelInserts(prev => [...prev, {
        id: `si-${Date.now()}`,
        featId: selPopup.featId,
        bulletIdx: selPopup.bulletIdx,
        text: selResponse.suggestion,
      }])
    }
    savedRangeRef.current = null
    setSelPopup(null)
    setSelResponse(null)
  }

  const handleAskInline = async (featId, bulletIdx, lineText, featTitle, featContext) => {
    const key = bulletIdx !== null ? `${featId}-${bulletIdx}` : `${featId}-title`

    // Also notify parent for activity log
    if (onAskAI) {
      onAskAI(featId, featTitle, featContext)
    }

    setLoadingKeys(prev => new Set([...prev, key]))

    const prompt = bulletIdx !== null
      ? `For the feature "${featTitle}", suggest improvements or implementation details for this specific point: "${lineText}"`
      : `For the feature "${featTitle}", give a concise implementation plan or suggestions.`

    const response = await askAI(prompt, featContext)

    setAiResponses(prev => ({ ...prev, [key]: response }))
    setLoadingKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const [acceptedKeys, setAcceptedKeys] = useState(new Set())

  const dismissResponse = (key) => {
    setAiResponses(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setAcceptedKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const acceptResponse = (key) => {
    setAcceptedKeys(prev => new Set([...prev, key]))
  }

  return (
    <div className="doc-panel">
      <div className="doc-body" ref={docBodyRef} style={{ position: 'relative' }}>

        {/* Selection AI Popup */}
        {selPopup && (
          <div
            className="sel-popup"
            style={{ left: selPopup.x, top: selPopup.y }}
          >
            {!selResponse && !selLoading && (
              <>
                <div className="sel-popup-actions">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} className="sel-action-btn" onClick={() => handleSelAction(a.prompt)}>
                      <AiIcon size={10} />
                      {a.label}
                    </button>
                  ))}
                </div>
                <form className="sel-popup-input-row" onSubmit={handleSelCustom}>
                  <input
                    className="sel-popup-input"
                    placeholder="Ask AI anything..."
                    value={selInput}
                    onChange={e => setSelInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="sel-popup-send">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </form>
              </>
            )}

            {selLoading && (
              <div className="sel-popup-loading">
                <div className="doc-ai-shimmer" style={{ padding: '4px 0' }}>
                  <div className="shimmer-line" style={{ width: '90%' }} />
                  <div className="shimmer-line" style={{ width: '70%', animationDelay: '0.15s' }} />
                </div>
              </div>
            )}

            {selResponse && !selLoading && (
              <div className="sel-popup-response">
                <div className="sel-response-text" dangerouslySetInnerHTML={{ __html: renderMd(selResponse.suggestion) }} />
                <div className="sel-response-actions">
                  <button className="sel-res-btn accept" onClick={handleSelAccept}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Accept
                  </button>
                  <button className="sel-res-btn insert" onClick={handleSelInsertBelow}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                    Insert below
                  </button>
                  <button className="sel-res-btn retry" onClick={() => handleSelAction(QUICK_ACTIONS[0].prompt)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                    Try again
                  </button>
                  <button className="sel-res-btn discard" onClick={() => { setSelPopup(null); setSelResponse(null) }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {features.map((feat) => {
          const titleKey = `${feat.id}-title`
          const titleLoading = loadingKeys.has(titleKey)
          const titleResponse = aiResponses[titleKey]
          const featContext = feat.bullets.map(b => b.text).join('\n')

          return (
            <div key={feat.id} className="doc-feature">
              {/* Feature title */}
              <div className="doc-feat-title">
                <span
                  className="doc-feat-title-text"
                  contentEditable={editingKey === `${feat.id}-title`}
                  suppressContentEditableWarning
                  onDoubleClick={() => setEditingKey(`${feat.id}-title`)}
                  onBlur={e => { updateField(feat.id, 'title', e.currentTarget.textContent); setEditingKey(null) }}
                  title={editingKey === `${feat.id}-title` ? '' : 'Double-click to edit'}
                >
                  {feat.title}
                </span>
                <div className="doc-feat-actions">
                  <button
                    className="doc-implement-btn"
                    onClick={() => {
                      if (onAskAI) onAskAI(feat.id, feat.title, featContext)
                    }}
                    title="Implement"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </button>
                  <button
                    className="doc-ask-ai-btn"
                    onClick={() => handleAskInline(feat.id, null, feat.title, feat.title, featContext)}
                    disabled={titleLoading}
                  >
                    {titleLoading ? (
                      <span className="doc-ai-spinner" />
                    ) : (
                      <AiIcon size={11} />
                    )}
                    Ask AI
                  </button>
                </div>
              </div>

              {/* AI shimmer loading for title */}
              {titleLoading && (
                <div className="doc-ai-inline shimmer-container">
                  <div className="doc-ai-inline-header">
                    <AiIcon size={11} />
                    <span>AI is thinking...</span>
                  </div>
                  <div className="doc-ai-shimmer">
                    <div className="shimmer-line" style={{ width: '92%' }} />
                    <div className="shimmer-line" style={{ width: '78%', animationDelay: '0.15s' }} />
                    <div className="shimmer-line" style={{ width: '85%', animationDelay: '0.3s' }} />
                    <div className="shimmer-line short" style={{ width: '45%', animationDelay: '0.45s' }} />
                  </div>
                </div>
              )}

              {/* AI response for title */}
              {titleResponse && (
                <div className={`doc-ai-inline doc-ai-reveal ${acceptedKeys.has(titleKey) ? 'accepted' : ''}`}>
                  <div className="doc-ai-inline-header">
                    <AiIcon size={11} />
                    <span>AI</span>
                    {acceptedKeys.has(titleKey) ? (
                      <span className="doc-ai-accepted-badge">Added to doc</span>
                    ) : (
                      <div className="doc-ai-actions">
                        <button className="doc-ai-accept" onClick={() => acceptResponse(titleKey)} title="Add to document">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button className="doc-ai-reject" onClick={() => dismissResponse(titleKey)} title="Discard">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    className={`doc-ai-inline-text ${acceptedKeys.has(titleKey) ? 'editable' : ''}`}
                    dangerouslySetInnerHTML={{ __html: renderMd(titleResponse) }}
                  />
                </div>
              )}

              {/* Description */}
              {feat.description && (
                editingKey === `${feat.id}-desc` ? (
                  <p
                    className="doc-feat-desc"
                    contentEditable
                    suppressContentEditableWarning
                    autoFocus
                    onBlur={e => { updateField(feat.id, 'description', e.currentTarget.textContent); setEditingKey(null) }}
                  >
                    {feat.description}
                  </p>
                ) : (
                  <p
                    className="doc-feat-desc"
                    onDoubleClick={() => setEditingKey(`${feat.id}-desc`)}
                    title="Double-click to edit"
                    dangerouslySetInnerHTML={{ __html: renderMd(feat.description) }}
                  />
                )
              )}

              {/* Bullets */}
              <div className="doc-bullets">
                {feat.bullets.map((bullet, bi) => {
                  const bulletText = bullet.text
                  const bulletKey = `${feat.id}-${bi}`
                  const isLoading = loadingKeys.has(bulletKey)
                  const response = aiResponses[bulletKey]

                  return (
                    <div key={bi} className="doc-bullet-block" data-feat-id={feat.id} data-bullet-idx={bi}>
                      <div className="doc-bullet-row">
                        <span className="doc-bullet-marker">•</span>
                        {editingKey === `${feat.id}-bullet-${bi}` ? (
                          <span
                            className="doc-bullet-text"
                            contentEditable
                            suppressContentEditableWarning
                            autoFocus
                            onBlur={e => { updateField(feat.id, `bullet-${bi}`, e.currentTarget.textContent); setEditingKey(null) }}
                          >
                            {bulletText}
                          </span>
                        ) : (
                          <span
                            className="doc-bullet-text"
                            onDoubleClick={() => setEditingKey(`${feat.id}-bullet-${bi}`)}
                            title="Double-click to edit"
                            dangerouslySetInnerHTML={{ __html: renderMd(bulletText) }}
                          />
                        )}
                        <button
                          className="doc-bullet-ai-btn"
                          onClick={() => handleAskInline(feat.id, bi, bulletText, feat.title, featContext)}
                          disabled={isLoading}
                          title="Ask AI about this"
                        >
                          {isLoading ? (
                            <span className="doc-ai-spinner" />
                          ) : (
                            <AiIcon size={11} />
                          )}
                        </button>
                      </div>

                      {/* AI shimmer loading for bullet */}
                      {isLoading && (
                        <div className="doc-ai-inline shimmer-container">
                          <div className="doc-ai-inline-header">
                            <AiIcon size={11} />
                            <span>AI is thinking...</span>
                          </div>
                          <div className="doc-ai-shimmer">
                            <div className="shimmer-line" style={{ width: '90%' }} />
                            <div className="shimmer-line" style={{ width: '75%', animationDelay: '0.15s' }} />
                            <div className="shimmer-line" style={{ width: '82%', animationDelay: '0.3s' }} />
                            <div className="shimmer-line short" style={{ width: '40%', animationDelay: '0.45s' }} />
                          </div>
                        </div>
                      )}

                      {/* AI response inline below this bullet */}
                      {response && (
                        <div className={`doc-ai-inline doc-ai-reveal ${acceptedKeys.has(bulletKey) ? 'accepted' : ''}`}>
                          <div className="doc-ai-inline-header">
                            <AiIcon size={11} />
                            <span>AI</span>
                            {acceptedKeys.has(bulletKey) ? (
                              <span className="doc-ai-accepted-badge">Added to doc</span>
                            ) : (
                              <div className="doc-ai-actions">
                                <button className="doc-ai-accept" onClick={() => acceptResponse(bulletKey)} title="Add to document">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                                <button className="doc-ai-reject" onClick={() => dismissResponse(bulletKey)} title="Discard">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                          <div
                            className={`doc-ai-inline-text ${acceptedKeys.has(bulletKey) ? 'editable' : ''}`}
                            dangerouslySetInnerHTML={{ __html: renderMd(response) }}
                          />
                        </div>
                      )}

                      {selInserts
                        .filter(ins => ins.featId === feat.id && ins.bulletIdx === bi)
                        .map(ins => (
                          <div key={ins.id} className="doc-ai-inline doc-ai-reveal sel-insert-card">
                            <div className="doc-ai-inline-header">
                              <AiIcon size={11} />
                              <span>Inserted</span>
                              <button
                                className="doc-ai-reject"
                                style={{ marginLeft: 'auto' }}
                                title="Remove"
                                onClick={() => setSelInserts(prev => prev.filter(i => i.id !== ins.id))}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                            <div className="doc-ai-inline-text" dangerouslySetInnerHTML={{ __html: renderMd(ins.text) }} />
                          </div>
                        ))
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
