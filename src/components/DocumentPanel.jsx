import { useState, useRef, useEffect } from 'react'
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
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    )}
                    Ask AI
                  </button>
                </div>
              </div>

              {/* AI shimmer loading for title */}
              {titleLoading && (
                <div className="doc-ai-inline shimmer-container">
                  <div className="doc-ai-inline-header">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
                  <div className="doc-ai-inline-text" dangerouslySetInnerHTML={{ __html: renderMd(titleResponse) }} />
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
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          )}
                        </button>
                      </div>

                      {/* AI shimmer loading for bullet */}
                      {isLoading && (
                        <div className="doc-ai-inline shimmer-container">
                          <div className="doc-ai-inline-header">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
                          <div className="doc-ai-inline-text" dangerouslySetInnerHTML={{ __html: renderMd(response) }} />
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
