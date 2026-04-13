import { useState, useRef, useEffect } from 'react'
import { agentSessions, featureDocItems } from '../data/sampleData'
import './ChatWindows.css'

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const MODEL = 'openai/gpt-4o-mini'

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/(<\/ul>\s*<ul>)/g, '')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

async function callAI(messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Innernet',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 500 }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const data = await res.json()
  console.log('%c💬 Chat Response', 'color: #22c55e; font-weight: bold', data.choices?.[0]?.message?.content)
  console.log('%cTokens:', 'color: #f59e0b; font-weight: bold', data.usage)
  return data.choices?.[0]?.message?.content || 'No response.'
}

function buildInitialMessages(window) {
  if (window.isFeature) {
    return [
      { role: 'system', content: `You are an expert software engineer helping implement features for a productivity app called Innernet. Be concise, technical, and actionable.` },
      { role: 'user', content: `Implement this feature:\n\n${window.context}` },
    ]
  }
  const session = agentSessions.find(s => s.id === window.id)
  const msgs = session?.messages || []
  return [
    { role: 'system', content: `You are an expert software engineer helping implement features for a productivity app called Innernet. Be concise, technical, and actionable.` },
    ...msgs.filter(m => m.role !== 'system'),
  ]
}

export default function ChatWindows({ featureWindows = [], onClose }) {
  const [activeTab, setActiveTab] = useState(featureWindows[0]?.id || featureDocItems[0]?.id)
  const [inputValues, setInputValues] = useState({})
  const [loadingTabs, setLoadingTabs] = useState(new Set())
  const messagesEndRef = useRef({})

  // All windows metadata
  const allWindowsMeta = [
    ...featureWindows.map(fw => ({
      id: fw.id,
      title: fw.title,
      isFeature: true,
      context: fw.context,
    })),
    ...featureDocItems
      .filter(f => !featureWindows.some(fw => fw.id === f.id))
      .map(f => ({
        id: f.id,
        title: f.title,
        isFeature: false,
        context: '',
      })),
  ]

  // Conversations keyed by window id — { role, content }[]
  const [conversations, setConversations] = useState(() => {
    const init = {}
    allWindowsMeta.forEach(w => {
      init[w.id] = buildInitialMessages(w)
    })
    return init
  })

  // Sync new featureWindows into conversations when they arrive
  useEffect(() => {
    featureWindows.forEach(fw => {
      setConversations(prev => {
        if (prev[fw.id]) return prev
        return { ...prev, [fw.id]: buildInitialMessages({ ...fw, isFeature: true }) }
      })
    })
    if (featureWindows.length > 0) {
      setActiveTab(featureWindows[featureWindows.length - 1].id)
    }
  }, [featureWindows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = messagesEndRef.current[activeTab]
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, activeTab])

  const activeWindow = allWindowsMeta.find(w => w.id === activeTab) || allWindowsMeta[0]
  const activeMessages = conversations[activeTab] || []
  const visibleMessages = activeMessages.filter(m => m.role !== 'system')

  const sendMessage = async (tabId, text) => {
    if (!text.trim() || loadingTabs.has(tabId)) return

    const userMsg = { role: 'user', content: text.trim() }
    const updatedMsgs = [...(conversations[tabId] || []), userMsg]

    setConversations(prev => ({ ...prev, [tabId]: updatedMsgs }))
    setInputValues(prev => ({ ...prev, [tabId]: '' }))
    setLoadingTabs(prev => new Set([...prev, tabId]))

    try {
      const reply = await callAI(updatedMsgs)
      setConversations(prev => ({
        ...prev,
        [tabId]: [...(prev[tabId] || []), { role: 'assistant', content: reply }],
      }))
    } catch (err) {
      setConversations(prev => ({
        ...prev,
        [tabId]: [...(prev[tabId] || []), { role: 'assistant', content: `**Error:** ${err.message} — check your API key.` }],
      }))
    } finally {
      setLoadingTabs(prev => { const n = new Set(prev); n.delete(tabId); return n })
    }
  }

  return (
    <div className="chat-windows">
      {/* Tab bar */}
      <div className="cw-tabs">
        <div className="cw-tabs-scroll">
          {allWindowsMeta.map(w => (
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
              {loadingTabs.has(w.id) && <span className="cw-tab-dot" style={{ background: '#f59e0b' }} />}
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
            {visibleMessages.map((msg, i) => (
              <div key={i} className={`cw-msg ${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="cw-msg-user-row">
                    <div className="cw-msg-bubble user">{msg.content}</div>
                  </div>
                ) : (
                  <div className="cw-msg-ai-row">
                    <div className="cw-msg-ai-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loadingTabs.has(activeTab) && (
              <div className="cw-msg assistant">
                <div className="cw-msg-ai-row">
                  <div className="cw-msg-ai-content cw-thinking">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={el => messagesEndRef.current[activeTab] = el} />
          </div>

          <div className="cw-input-area">
            <div className="cw-input-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <input
                type="text"
                placeholder={loadingTabs.has(activeTab) ? 'AI is thinking...' : 'Ask the agent...'}
                value={inputValues[activeTab] || ''}
                disabled={loadingTabs.has(activeTab)}
                onChange={e => setInputValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') sendMessage(activeTab, inputValues[activeTab] || '')
                }}
              />
              <button
                className="cw-send-btn"
                disabled={loadingTabs.has(activeTab)}
                onClick={() => sendMessage(activeTab, inputValues[activeTab] || '')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {allWindowsMeta.length === 0 && (
        <div className="cw-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p>No active sessions</p>
          <span>Click "Implement" on a feature to start an agent session</span>
        </div>
      )}
    </div>
  )
}
