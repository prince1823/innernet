import { useState, useRef, useEffect } from 'react'
import { featureDocItems } from '../data/sampleData'
import { askAI } from '../utils/askAI'
import './DocumentPanel.css'

function AiIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      {/* Chip */}
      <rect x="18" y="4" width="28" height="28" rx="5" />
      {/* Chip pins */}
      <rect x="24" y="1" width="3" height="5" rx="1" />
      <rect x="31" y="1" width="3" height="5" rx="1" />
      <rect x="37" y="1" width="3" height="5" rx="1" />
      <rect x="24" y="30" width="3" height="5" rx="1" />
      <rect x="31" y="30" width="3" height="5" rx="1" />
      <rect x="37" y="30" width="3" height="5" rx="1" />
      <rect x="14" y="10" width="5" height="3" rx="1" />
      <rect x="14" y="17" width="5" height="3" rx="1" />
      <rect x="14" y="24" width="5" height="3" rx="1" />
      <rect x="45" y="10" width="5" height="3" rx="1" />
      <rect x="45" y="17" width="5" height="3" rx="1" />
      <rect x="45" y="24" width="5" height="3" rx="1" />
      {/* AI text */}
      <text x="32" y="23" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">AI</text>
      {/* Hand */}
      <path d="M14 54 C14 54 14 48 20 48 L38 48 C42 48 44 44 40 42 L36 40 C34 39 36 36 38 37 L52 44 C56 46 56 52 52 56 L40 62 C36 64 28 64 24 62 L14 56 Z" />
      <rect x="4" y="48" width="10" height="16" rx="3" />
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

export default function DocumentPanel({ onAskAI, activeAgentFeatures = [] }) {
  const [aiResponses, setAiResponses] = useState({}) // key: "featId-bulletIdx" or "featId-title"
  const [loadingKeys, setLoadingKeys] = useState(new Set())

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
      <div className="doc-body">
        {featureDocItems.map((feat) => {
          const titleKey = `${feat.id}-title`
          const titleLoading = loadingKeys.has(titleKey)
          const titleResponse = aiResponses[titleKey]
          const featContext = feat.bullets.map(b => typeof b === 'string' ? b : b.text).join('\n')

          return (
            <div key={feat.id} className="doc-feature">
              {/* Feature title */}
              <div className="doc-feat-title">
                <span className="doc-feat-title-text" contentEditable suppressContentEditableWarning>
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
                    contentEditable={acceptedKeys.has(titleKey)}
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: renderMd(titleResponse) }}
                  />
                </div>
              )}

              {/* Description */}
              {feat.description && (
                <p className="doc-feat-desc" contentEditable suppressContentEditableWarning>
                  {feat.description}
                </p>
              )}

              {/* Bullets */}
              <div className="doc-bullets">
                {feat.bullets.map((bullet, bi) => {
                  const bulletText = typeof bullet === 'string' ? bullet : bullet.text
                  const bulletKey = `${feat.id}-${bi}`
                  const isLoading = loadingKeys.has(bulletKey)
                  const response = aiResponses[bulletKey]

                  return (
                    <div key={bi} className="doc-bullet-block">
                      <div className="doc-bullet-row">
                        <span className="doc-bullet-marker">•</span>
                        <span className="doc-bullet-text" contentEditable suppressContentEditableWarning>
                          {bulletText}
                        </span>
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
                            contentEditable={acceptedKeys.has(bulletKey)}
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{ __html: renderMd(response) }}
                          />
                        </div>
                      )}
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
