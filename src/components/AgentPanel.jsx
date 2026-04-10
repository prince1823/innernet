import { useState } from 'react'
import { agentSessions } from '../data/sampleData'
import './AgentPanel.css'

export default function AgentPanel() {
  const [activeSession, setActiveSession] = useState(3)
  const [inputValue, setInputValue] = useState('')

  const session = agentSessions.find(s => s.id === activeSession)

  return (
    <div className="agent-panel">
      {/* Sessions Sidebar */}
      <div className="agent-sidebar">
        <div className="asb-header">
          <span className="asb-label">Sessions</span>
          <button className="asb-new-btn" title="New session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
        <div className="asb-sessions">
          {agentSessions.map(s => (
            <button
              key={s.id}
              className={`asb-item ${s.id === activeSession ? 'active' : ''}`}
              onClick={() => setActiveSession(s.id)}
            >
              <div className="asb-item-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div className="asb-item-info">
                <span className="asb-item-name">{s.title}</span>
                <span className="asb-item-preview">{s.preview}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="agent-chat">
        <div className="achat-header">
          <div>
            <span className="achat-title">{session?.title}</span>
            <span className="achat-date">{session?.date}</span>
          </div>
          <div className="achat-header-actions">
            <button className="achat-action" title="Context">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
            <button className="achat-action" title="Clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Context Banner */}
        <div className="context-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>Using context from <strong>Apr 5-6 notes</strong> and <strong>calendar summary</strong></span>
        </div>

        <div className="achat-messages">
          {session?.messages.map((msg, i) => (
            <div key={i} className={`amsg ${msg.role}`}>
              <div className="amsg-avatar">
                {msg.role === 'user' ? (
                  <div className="av-user">PS</div>
                ) : (
                  <div className="av-ai">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="amsg-body">
                <div className="amsg-role">{msg.role === 'user' ? 'You' : 'Agent'}</div>
                <div className={`amsg-content ${msg.role}`}>{msg.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="achat-input-area">
          <div className="achat-input-box">
            <div className="input-prefix">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Ask AI a question..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setInputValue('')}
            />
            <div className="input-actions">
              <button className="input-attach" title="Attach notes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <button className="input-send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="input-hint-row">
            <span className="input-hint">Agent can reference your notes and calendar context</span>
          </div>
        </div>
      </div>
    </div>
  )
}
