import { useState } from 'react'
import { agentSessions, featureDocItems } from '../data/sampleData'
import './ChatWindows.css'

export default function ChatWindows({ featureWindows = [], onClose }) {
  const [activeTab, setActiveTab] = useState(featureWindows[0]?.id || featureDocItems[0]?.id)
  const [inputValues, setInputValues] = useState({})

  // Combine feature-spawned windows with default feature doc tabs
  const allWindows = [
    ...featureWindows.map(fw => ({
      id: fw.id,
      title: fw.title,
      isFeature: true,
      messages: [
        { role: 'system', content: `Agent session started for: ${fw.title}` },
        { role: 'user', content: `Implement this feature:\n\n${fw.context}` },
        { role: 'assistant', content: `I'll start working on "${fw.title}". Let me analyze the requirements and create an implementation plan.\n\n**Analyzing:**\n- Feature scope and requirements\n- Dependencies and integration points\n- Implementation approach\n\nI'll begin with the core implementation...` },
      ]
    })),
    ...featureDocItems
      .filter(f => !featureWindows.some(fw => fw.id === f.id))
      .map(f => ({
        id: f.id,
        title: f.title,
        isFeature: false,
        messages: agentSessions[0]?.messages || [],
      })),
  ]

  const activeWindow = allWindows.find(w => w.id === activeTab) || allWindows[0]

  return (
    <div className="chat-windows">
      {/* Tab bar */}
      <div className="cw-tabs">
        <div className="cw-tabs-scroll">
          {allWindows.map(w => (
            <button
              key={w.id}
              className={`cw-tab ${w.id === activeTab ? 'active' : ''} ${w.isFeature ? 'feature' : ''}`}
              onClick={() => setActiveTab(w.id)}
            >
              {w.isFeature ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
              <span className="cw-tab-title">{w.title}</span>
              {w.isFeature && (
                <span className="cw-tab-status">
                  <span className="cw-tab-dot" />
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="cw-new-tab" title="New session">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* Chat content */}
      {activeWindow && (
        <div className="cw-chat">

          <div className="cw-messages">
            {activeWindow.messages?.map((msg, i) => (
              <div key={i} className={`cw-msg ${msg.role}`}>
                {msg.role === 'system' ? (
                  <div className="cw-msg-system">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span>{msg.content}</span>
                  </div>
                ) : (
                  <>
                    <div className="cw-msg-avatar">
                      {msg.role === 'user' ? (
                        <div className="cw-av-user">PS</div>
                      ) : (
                        <div className="cw-av-ai">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </div>
                      )}
                    </div>
                    <div className="cw-msg-body">
                      <div className="cw-msg-role">{msg.role === 'user' ? 'You' : 'Agent'}</div>
                      <div className={`cw-msg-content ${msg.role}`}>{msg.content}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="cw-input-area">
            <div className="cw-input-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <input
                type="text"
                placeholder="Ask the agent..."
                value={inputValues[activeTab] || ''}
                onChange={e => setInputValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') setInputValues(prev => ({ ...prev, [activeTab]: '' }))
                }}
              />
              <button className="cw-send-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {allWindows.length === 0 && (
        <div className="cw-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p>No active sessions</p>
          <span>Click "Ask AI" on a feature or "Implement All" to start agent sessions</span>
        </div>
      )}
    </div>
  )
}
