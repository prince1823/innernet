import { useState, useRef, useEffect } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/atom-one-light.css'
import { logActivity } from '../utils/activityLog'
import './DoPanel.css'

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const MODEL = 'openai/gpt-4o-mini'

const TAB_TYPES = [
  { type: 'claude', label: 'Claude', icon: 'claude' },
  { type: 'browser', label: 'Browser', icon: 'browser' },
  { type: 'terminal', label: 'Terminal', icon: 'terminal' },
]

const NEW_TAB_URL = 'about:newtab'
// CORS proxy used when the user toggles "proxy mode" on a tab — lets us embed
// sites that send X-Frame-Options: DENY. Third-party, rate-limited, and breaks
// on sites whose scripts rely on same-origin requests. Off by default.
const PROXIES = [
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(url),
]

async function fetchViaProxy(url) {
  let lastErr
  for (const build of PROXIES) {
    try {
      const r = await fetch(build(url))
      if (!r.ok) throw new Error('status ' + r.status)
      return await r.text()
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('all proxies failed')
}

let uid = 0
const nextId = () => `tab-${Date.now()}-${++uid}`

function TabIcon({ kind }) {
  if (kind === 'claude') {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  }
  if (kind === 'browser') {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  }
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
}

function renderMarkdown(text) {
  if (!text) return ''
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // fenced code blocks — wrap in a block that has its own copy button handled
  // via delegated click on the messages container (see ClaudePane)
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const clean = code.replace(/\n$/, '')
    let highlighted, detectedLang = lang
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(clean, { language: lang, ignoreIllegals: true }).value
      } else {
        const auto = hljs.highlightAuto(clean)
        highlighted = auto.value
        if (!detectedLang && auto.language) detectedLang = auto.language
      }
    } catch {
      highlighted = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
    const label = detectedLang || 'code'
    return `<div class="do-md-pre-wrap"><div class="do-md-pre-head"><span class="do-md-pre-lang">${label}</span><button type="button" class="do-md-copy" data-copy-code title="Copy code" aria-label="Copy code"><svg class="do-md-copy-default" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="do-md-copy-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button></div><pre class="do-md-pre"><code class="hljs">${highlighted}</code></pre></div>`
  })
  // headings
  s = s.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  s = s.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/^### (.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^# (.+)$/gm, '<h2>$1</h2>')
  // group list items
  s = s.replace(/(?:^|\n)((?:[ \t]*[-*] .+(?:\n|$))+)/g, (_, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[ \t]*[-*] /, '').trim()).map(x => `<li>${x}</li>`).join('')
    return `\n<ul>${items}</ul>`
  })
  s = s.replace(/(?:^|\n)((?:[ \t]*\d+\. .+(?:\n|$))+)/g, (_, block) => {
    const items = block.trim().split(/\n/).map(l => l.replace(/^[ \t]*\d+\. /, '').trim()).map(x => `<li>${x}</li>`).join('')
    return `\n<ol>${items}</ol>`
  })
  // inline formatting
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^\*])\*(?!\s)([^\*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // paragraphs
  const blocks = s.split(/\n{2,}/)
  s = blocks.map(b => {
    const t = b.trim()
    if (!t) return ''
    if (/^<(h\d|ul|ol|pre|blockquote)/.test(t)) return t
    return '<p>' + t.replace(/\n/g, '<br/>') + '</p>'
  }).join('\n')
  // Merge adjacent lists so consecutive numbered items don't each restart at 1
  s = s.replace(/<\/ol>\s*<ol>/g, '').replace(/<\/ul>\s*<ul>/g, '')
  return s
}

async function streamAI(messages, onChunk, { signal } = {}) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Innernet',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 800, stream: true }),
    signal,
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const l = line.trim()
      if (!l.startsWith('data:')) continue
      const data = l.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onChunk(delta)
      } catch {}
    }
  }
}

// ─────────────────────────── Claude pane ───────────────────────────
const CLAUDE_HISTORY_KEY = 'innernet:claude-history:v1'
const CLAUDE_SIDEBAR_KEY = 'innernet:claude-sidebar:v1'

function loadClaudeHistory() {
  try {
    const raw = localStorage.getItem(CLAUDE_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveClaudeHistory(list) {
  try { localStorage.setItem(CLAUDE_HISTORY_KEY, JSON.stringify(list)) } catch {}
}

function deriveConversationTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user')
  const text = (firstUser?.content || 'New conversation').trim().replace(/\s+/g, ' ')
  return text.length > 48 ? text.slice(0, 48) + '…' : text
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

const PLACEHOLDER_PROMPTS = [
  'Ask something..',
  'Draft a quick standup update…',
  'Summarize my day from the calendar…',
  'What should I tackle next?',
  'Rewrite this paragraph to sound sharper…',
  'Explain this bug to me like I\u2019m five…',
  'Brainstorm names for a side project…',
  'Plan a 30-min focus block for me…',
  'Turn these notes into a changelog…',
  'What\u2019s a good unit test for this?',
]

const GREETINGS = [
  { pre: 'Hello', name: 'Tanuj' },
  { pre: 'Welcome back', name: 'Tanuj' },
  { pre: 'Good to see you', name: 'Tanuj' },
  { pre: "What's on your mind", name: 'Tanuj' },
  { pre: 'Ready when you are', name: 'Tanuj' },
  { pre: 'Let\u2019s build something', name: 'Tanuj' },
  { pre: 'Howdy', name: 'Tanuj' },
  { pre: 'Back at it', name: 'Tanuj' },
  { pre: 'Good to have you', name: 'Tanuj' },
  { pre: 'Where shall we start', name: 'Tanuj' },
]

function ClaudePane({ tab, updateTab }) {
  const state = tab.data
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)
  const [greetingIdx, setGreetingIdx] = useState(() => Math.floor(Math.random() * GREETINGS.length))
  const [placeholderIdx, setPlaceholderIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDER_PROMPTS.length))
  const [history, setHistory] = useState(loadClaudeHistory)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLAUDE_SIDEBAR_KEY) ?? 'true') } catch { return true }
  })
  const isEmpty = state.messages.length === 0

  // Backfill conversationId on legacy tabs
  useEffect(() => {
    if (!state.conversationId) {
      updateTab({ data: { ...state, conversationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } })
    }
  }, [state.conversationId])

  useEffect(() => {
    try { localStorage.setItem(CLAUDE_SIDEBAR_KEY, JSON.stringify(sidebarOpen)) } catch {}
  }, [sidebarOpen])

  // Auto-save current conversation to history whenever messages settle
  useEffect(() => {
    const convId = state.conversationId
    if (!convId || loading) return
    const hasUser = state.messages.some(m => m.role === 'user')
    if (!hasUser) return
    setHistory(prev => {
      const entry = {
        id: convId,
        title: deriveConversationTitle(state.messages),
        messages: state.messages,
        updatedAt: Date.now(),
      }
      const next = [entry, ...prev.filter(h => h.id !== convId)]
      saveClaudeHistory(next)
      return next
    })
  }, [state.messages, loading, state.conversationId])

  const newChat = () => {
    if (loading) abortRef.current?.abort()
    updateTab({ data: { ...state, messages: [], conversationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } })
    setInput('')
  }

  const loadConversation = (id) => {
    const entry = history.find(h => h.id === id)
    if (!entry) return
    if (loading) abortRef.current?.abort()
    updateTab({ data: { ...state, messages: entry.messages, conversationId: entry.id } })
  }

  const deleteConversation = (id, e) => {
    e?.stopPropagation()
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id)
      saveClaudeHistory(next)
      return next
    })
    if (id === state.conversationId) {
      updateTab({ data: { ...state, messages: [], conversationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } })
    }
  }
  // Rotate through greetings every 4s while the pane is idle (empty + no
  // loading). Stops rotating once the user sends a message.
  useEffect(() => {
    if (!isEmpty || loading) return
    const id = setInterval(() => {
      setGreetingIdx(i => (i + 1) % GREETINGS.length)
    }, 3500)
    return () => clearInterval(id)
  }, [isEmpty, loading])

  // Rotate placeholder prompts while the input is empty and not loading.
  useEffect(() => {
    if (loading || input) return
    const id = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_PROMPTS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [loading, input])

  const scrollToBottom = (behavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  // Only auto-scroll when the user is already near the bottom — if they've
  // scrolled up to read earlier content mid-response, don't yank them back.
  useEffect(() => {
    if (atBottom) scrollToBottom('smooth')
  }, [state.messages, loading, streaming, atBottom])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setAtBottom(distance < 60)
  }

  // auto-grow the textarea to fit content, capped so it doesn't swallow the pane
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [input])

  const runTurn = async (messagesForTurn, finalMessages) => {
    setLoading(true)
    setStreaming('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let accum = ''
    try {
      await streamAI(
        [
          { role: 'system', content: 'You are Claude, an assistant inside the Innernet productivity app. Be concise, helpful, and technical when appropriate. Use markdown formatting — headings, bullet lists, code blocks — for anything more than a one-liner.' },
          ...messagesForTurn,
        ],
        (chunk) => { accum += chunk; setStreaming(accum) },
        { signal: ctrl.signal }
      )
      updateTab({ data: { ...state, messages: [...finalMessages, { role: 'assistant', content: accum || 'No response.' }] } })
    } catch (err) {
      const aborted = err.name === 'AbortError' || ctrl.signal.aborted
      const msg = aborted
        ? { role: 'assistant', content: accum ? accum + '\n\n_[stopped]_' : '_[stopped]_' }
        : { role: 'assistant', content: '', error: err.message || 'Something went wrong' }
      updateTab({ data: { ...state, messages: [...finalMessages, msg] } })
    } finally {
      abortRef.current = null
      setStreaming('')
      setLoading(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    const nextMessages = [...state.messages, userMsg]
    updateTab({ data: { ...state, messages: nextMessages } })
    setInput('')
    logActivity('claude_prompt', { source: 'claude', label: `Asked Claude: "${text.length > 80 ? text.slice(0, 80) + '…' : text}"`, prompt: text })
    await runTurn(nextMessages, nextMessages)
  }

  const stop = () => { abortRef.current?.abort() }

  const retryLast = async () => {
    if (loading) return
    const msgs = [...state.messages]
    // strip trailing error/assistant messages back to the last user prompt
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return
    updateTab({ data: { ...state, messages: msgs } })
    await runTurn(msgs, msgs)
  }

  return (
    <div className="do-pane do-claude">
      <div className="do-claude-bg" aria-hidden="true">
        {/* SVG edge-detection filter used by the overlay video to draw dark
            outlines around bright shapes (the figure). Laplacian kernel
            extracts edges, then the feColorMatrix turns bright edges into
            opaque black and flat areas into transparent. */}
        <svg className="do-claude-bg-svg" width="0" height="0" aria-hidden="true">
          <defs>
            <filter id="do-claude-edges" colorInterpolationFilters="sRGB">
              <feConvolveMatrix order="3" preserveAlpha="true" edgeMode="duplicate" kernelMatrix="-1 -1 -1  -1  8 -1  -1 -1 -1" />
              <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   1.6 1.6 1.6 0 0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="1.2" intercept="-0.05" />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
        <video
          className="do-claude-bg-video"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
        />
        <video
          className="do-claude-bg-outline"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
        />
        <div className="do-claude-bg-veil" />
      </div>
      <aside className={`do-claude-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="do-claude-sidebar-head">
          <button
            className="do-claude-sidebar-toggle"
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Hide history' : 'Show history'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
          </button>
          {sidebarOpen && (
            <button className="do-claude-newchat" onClick={newChat} title="Start a new chat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>New chat</span>
            </button>
          )}
        </div>
        {sidebarOpen && (
          <div className="do-claude-sidebar-list">
            {history.length === 0 && (
              <div className="do-claude-sidebar-empty">No conversations yet</div>
            )}
            {history.map(h => (
              <div
                key={h.id}
                className={`do-claude-sidebar-item ${h.id === state.conversationId ? 'active' : ''}`}
                onClick={() => loadConversation(h.id)}
                title={h.title}
              >
                <div className="do-claude-sidebar-item-body">
                  <div className="do-claude-sidebar-item-title">{h.title}</div>
                  <div className="do-claude-sidebar-item-meta">{formatRelativeTime(h.updatedAt)}</div>
                </div>
                <button
                  className="do-claude-sidebar-item-del"
                  onClick={(e) => deleteConversation(h.id, e)}
                  title="Delete conversation"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>
      <div className="do-claude-main">
      {!sidebarOpen && (
        <button
          className="do-claude-sidebar-open-btn"
          onClick={() => setSidebarOpen(true)}
          title="Show history"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
        </button>
      )}
      <div
        className="do-claude-messages"
        ref={scrollRef}
        onScroll={onScroll}
        onClick={(e) => {
          const btn = e.target.closest?.('[data-copy-code]')
          if (!btn) return
          const wrap = btn.closest('.do-md-pre-wrap')
          const code = wrap?.querySelector('pre code')?.innerText || ''
          navigator.clipboard?.writeText(code)
          btn.classList.add('copied')
          setTimeout(() => btn.classList.remove('copied'), 1400)
        }}
      >
        {state.messages.length === 0 && (
          <div className="do-claude-hero">
            <h1 className="do-claude-greeting" key={greetingIdx}>{GREETINGS[greetingIdx].pre} <em>{GREETINGS[greetingIdx].name}</em></h1>
            <p className="do-claude-tagline">How can I help you today?</p>
          </div>
        )}
        {state.messages.map((m, i) => (
          <div key={i} className={`do-claude-msg ${m.role}`}>
            {m.role === 'user' ? (
              <div className="do-claude-bubble user">{m.content}</div>
            ) : m.error ? (
              <div className="do-claude-error">
                <div className="do-claude-error-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="do-claude-error-body">
                  <div className="do-claude-error-title">Something went wrong</div>
                  <div className="do-claude-error-detail">{m.error}</div>
                </div>
                <button className="do-claude-error-retry" onClick={retryLast} title="Retry">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  <span>Retry</span>
                </button>
              </div>
            ) : (
              <div className="do-claude-msg-col">
                <div className="do-claude-bubble assistant" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                <button
                  className="do-claude-msg-copy"
                  title="Copy response"
                  onClick={() => {
                    navigator.clipboard?.writeText(m.content)
                    const el = document.querySelectorAll('.do-claude-msg-copy')[i]
                    if (!el) return
                    el.classList.add('copied')
                    setTimeout(() => el.classList.remove('copied'), 1400)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <svg className="do-claude-msg-copy-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && streaming && (
          <div className="do-claude-msg assistant">
            <div className="do-claude-bubble assistant" dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming) + '<span class="do-claude-caret"></span>' }} />
          </div>
        )}
        {loading && !streaming && (
          <div className="do-claude-msg assistant">
            <div className="do-claude-bubble assistant do-claude-thinking">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>
      {!atBottom && state.messages.length > 0 && (
        <button className="do-claude-jump" onClick={() => { setAtBottom(true); scrollToBottom('auto') }} title="Jump to latest">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          <span>Jump to latest</span>
        </button>
      )}
      <div className="do-claude-input-wrap">
        <div className="do-claude-input">
          {!input && (
            <span className="do-claude-ph" aria-hidden="true">
              <span className="do-claude-ph-text" key={loading ? 'loading' : placeholderIdx}>
                {loading ? 'Claude is thinking…' : PLACEHOLDER_PROMPTS[placeholderIdx]}
              </span>
            </span>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder=""
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          {loading ? (
            <button className="do-claude-send do-claude-stop" onClick={stop} title="Stop generating">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>
            </button>
          ) : (
            <button className="do-claude-send" onClick={send} disabled={!input.trim()} title="Send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Browser pane ───────────────────────────
// Many popular sites (wikipedia.org, google.com) send X-Frame-Options that
// prevent iframe embedding. The pane still works like a browser — URL bar,
// back/forward, reload — but those specific sites render blank. For sites
// that allow embedding, you get full interactive browsing.
function BrowserPane({ tab, updateTab }) {
  const rawState = tab.data
  // Backfill proxy=true for tabs created before the field existed so existing
  // sessions don't render a blank X-Frame-Options iframe.
  const state = rawState.proxy === undefined ? { ...rawState, proxy: true } : rawState
  const iframeRef = useRef(null)
  const [addressInput, setAddressInput] = useState(state.url)
  const [proxyDoc, setProxyDoc] = useState('')
  const [proxyStatus, setProxyStatus] = useState('idle') // 'idle' | 'loading' | 'error'
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => { setAddressInput(state.url) }, [state.url])

  // When proxy mode is on, fetch the target HTML via CORS proxy and inject a
  // <base href> so relative asset URLs (CSS, JS, images) resolve against the
  // original host instead of 404-ing against corsproxy.io.
  useEffect(() => {
    if (!state.proxy || state.url === NEW_TAB_URL) {
      setProxyDoc('')
      setProxyStatus('idle')
      return
    }
    let cancelled = false
    setProxyStatus('loading')
    setProxyDoc('<!DOCTYPE html><html><head><style>body{font-family:system-ui,sans-serif;color:#6b7280;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.l{display:flex;align-items:center;gap:10px}.s{width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="l"><div class="s"></div>Loading ' + state.url.replace(/[<>&"]/g,'') + '…</div></body></html>')
    fetchViaProxy(state.url)
      .then(html => {
        if (cancelled) return
        const baseTag = `<base href="${state.url}">`
        let patched
        if (/<head[^>]*>/i.test(html)) {
          patched = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`)
        } else if (/<html[^>]*>/i.test(html)) {
          patched = html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`)
        } else {
          patched = `<head>${baseTag}</head>${html}`
        }
        setProxyDoc(patched)
        setProxyStatus('idle')
      })
      .catch(() => {
        if (cancelled) return
        setProxyStatus('error')
        setProxyDoc(`<!DOCTYPE html><html><body style="font-family:system-ui;color:#b91c1c;padding:28px"><h3 style="margin:0 0 8px">Couldn't load this page</h3><p style="color:#6b7280;margin:0 0 14px">The proxy couldn't reach ${state.url.replace(/[<>&"]/g,'')}.</p><p style="color:#6b7280;font-size:13px">Try toggling the shield off, or open the URL in a new window.</p></body></html>`)
      })
    return () => { cancelled = true }
  }, [state.proxy, state.url, retryKey])

  const normalizeUrl = (raw) => {
    const s = (raw || '').trim()
    if (!s) return state.url
    if (/^https?:\/\//i.test(s)) return s
    if (/^[\w-]+\.[\w.-]+/.test(s) && !/\s/.test(s)) return 'https://' + s
    return 'https://search.brave.com/search?q=' + encodeURIComponent(s)
  }

  const navigate = (raw) => {
    const url = normalizeUrl(raw)
    const history = [...state.history.slice(0, state.historyIdx + 1), url]
    updateTab({
      title: deriveTitle(url),
      data: { ...state, url, history, historyIdx: history.length - 1 },
    })
    logActivity('browser_nav', { source: 'browser', label: `Browsed ${deriveTitle(url)}`, url })
  }

  const goBack = () => {
    if (state.historyIdx <= 0) return
    const idx = state.historyIdx - 1
    updateTab({ title: deriveTitle(state.history[idx]), data: { ...state, url: state.history[idx], historyIdx: idx } })
  }
  const goForward = () => {
    if (state.historyIdx >= state.history.length - 1) return
    const idx = state.historyIdx + 1
    updateTab({ title: deriveTitle(state.history[idx]), data: { ...state, url: state.history[idx], historyIdx: idx } })
  }
  const reload = () => { if (iframeRef.current) iframeRef.current.src = state.url }

  return (
    <div className="do-pane do-browser">
      <div className="do-browser-chrome">
        <button className="do-browser-btn" onClick={goBack} disabled={state.historyIdx <= 0} title="Back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className="do-browser-btn" onClick={goForward} disabled={state.historyIdx >= state.history.length - 1} title="Forward">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button className="do-browser-btn" onClick={reload} title="Reload">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <div className="do-browser-url">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <input
            type="text"
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') navigate(addressInput) }}
            spellCheck={false}
          />
        </div>
        <button
          className={`do-browser-open do-browser-proxy ${state.proxy ? 'active' : ''}`}
          onClick={() => updateTab({ data: { ...state, proxy: !state.proxy } })}
          title={state.proxy ? 'Proxy mode ON — routes through corsproxy.io to bypass embed blocks' : 'Turn on proxy mode to load sites that block embedding'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </button>
        <button className="do-browser-open" onClick={() => window.open(state.url, '_blank', 'noopener')} title="Open in a real tab">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
      <div className="do-browser-viewport">
        {state.url === NEW_TAB_URL ? (
          <NewTabPage onSearch={navigate} />
        ) : (
          <>
            {state.proxy ? (
              proxyStatus === 'error' ? (
                <BrowserErrorPage url={state.url} onRetry={() => setRetryKey(k => k + 1)} onDisableProxy={() => updateTab({ data: { ...state, proxy: false } })} />
              ) : (
                <iframe
                  ref={iframeRef}
                  title="browser-tab"
                  srcDoc={proxyDoc || '<p style="font-family:system-ui;color:#6b7280;padding:24px">Preparing proxied page…</p>'}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                />
              )
            ) : (
              <iframe
                ref={iframeRef}
                title="browser-tab"
                src={state.url}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="do-browser-fallback">
              <span>Site blocks embedding? Try the shield <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> to enable proxy mode, or</span>
              <button onClick={() => window.open(state.url, '_blank', 'noopener')}>Open in new window</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BrowserErrorPage({ url, onRetry, onDisableProxy }) {
  let host = url
  try { host = new URL(url).hostname } catch {}
  return (
    <div className="do-browser-error">
      <div className="do-browser-error-card">
        <div className="do-browser-error-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>
        </div>
        <h3>{host} can't be reached</h3>
        <p>Sites like GitHub, Reddit, and X actively block scraping, so the proxy can't fetch their pages. The public CORS proxies we try may also be rate-limited.</p>
        <div className="do-browser-error-actions">
          <button className="primary" onClick={() => window.open(url, '_blank', 'noopener')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open in new window
          </button>
          <button onClick={onRetry}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Retry
          </button>
          <button onClick={onDisableProxy}>Try without proxy</button>
        </div>
        <div className="do-browser-error-hint">Tip: the shield works for most static sites (Wikipedia, MDN, React docs, Brave Search).</div>
      </div>
    </div>
  )
}

function NewTabPage({ onSearch }) {
  const [q, setQ] = useState('')
  // Only show shortcuts that are known to allow iframe embedding. For anything
  // else (GitHub, HN, Google, etc.) the user can type the URL and toggle the
  // shield icon to enable proxy mode.
  const shortcuts = [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page', color: '#1a1a2e' },
    { label: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/', color: '#de5833' },
    { label: 'MDN', url: 'https://developer.mozilla.org/', color: '#000000' },
    { label: 'arXiv', url: 'https://arxiv.org', color: '#b31b1b' },
  ]
  return (
    <div className="do-newtab-page">
      <div className="do-newtab-bg" aria-hidden="true">
        <div className="do-newtab-blob do-newtab-blob-a" />
        <div className="do-newtab-blob do-newtab-blob-b" />
        <div className="do-newtab-blob do-newtab-blob-c" />
      </div>
      <div className="do-newtab-content">
        <div className="do-newtab-brand">
          <svg className="do-newtab-brand-icon" viewBox="0 0 128 128" width="44" height="44" aria-hidden="true">
            <path fill="#fb542b" d="M64 12l26 10 8-6 20 20-10 12 6 18-10 44-20 18-20 10-20-10-20-18L14 66l6-18L10 36l20-20 8 6z"/>
            <path fill="#fff" d="M64 36l18 6 14-6 8 8-6 10 4 14-10 24-14 12-14 8-14-8-14-12-10-24 4-14-6-10 8-8 14 6z" opacity="0.15"/>
          </svg>
          <div className="do-newtab-brand-text">
            <div className="do-newtab-headline">Private search.<br/>Brave results.</div>
            <div className="do-newtab-sub">No tracking. No profiling. Just the web, the way it should be.</div>
          </div>
        </div>
        <form
          className="do-newtab-search"
          onSubmit={e => { e.preventDefault(); if (q.trim()) onSearch(q.trim()) }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search the web privately with Brave, or enter a URL"
            spellCheck={false}
          />
          <kbd className="do-newtab-kbd">⏎</kbd>
        </form>
        <div className="do-newtab-shortcuts">
          {shortcuts.map(s => (
            <button key={s.label} className="do-newtab-shortcut" onClick={() => onSearch(s.url)}>
              <span className="do-newtab-shortcut-dot" style={{ background: s.color }}>
                {s.label[0]}
              </span>
              <span className="do-newtab-shortcut-label">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="do-newtab-foot">Powered by Brave Search · Results are independent and unfiltered</div>
      </div>
    </div>
  )
}

function deriveTitle(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('wikipedia.org')) {
      const last = decodeURIComponent(u.pathname.split('/').pop() || '')
      if (last && last !== 'Main_Page') return last.replace(/_/g, ' ').slice(0, 24)
      return 'Wikipedia'
    }
    return u.hostname.replace(/^www\./, '').slice(0, 24)
  } catch {
    return 'Browser'
  }
}

// ─────────────────────────── Terminal pane ───────────────────────────
function TerminalPane({ tab, updateTab }) {
  const state = tab.data
  const [input, setInput] = useState('')
  const logRef = useRef(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [state.lines])

  const run = (cmd) => {
    const trimmed = cmd.trim()
    if (!trimmed) {
      updateTab({ data: { ...state, lines: [...state.lines, { kind: 'prompt', text: '' }] } })
      return
    }
    logActivity('terminal_cmd', { source: 'terminal', label: `Ran \`${trimmed}\``, command: trimmed })
    const [name, ...rest] = trimmed.split(/\s+/)
    const out = []
    switch (name) {
      case 'help':
        out.push('Available commands: help, echo <text>, date, whoami, pwd, ls, clear')
        break
      case 'echo':
        out.push(rest.join(' '))
        break
      case 'date':
        out.push(new Date().toString())
        break
      case 'whoami':
        out.push('user')
        break
      case 'pwd':
        out.push('~/innernet')
        break
      case 'ls':
        out.push('notes.txt  projects/  README.md')
        break
      case 'clear':
        updateTab({ data: { ...state, lines: [], history: [...state.history, trimmed] } })
        return
      default:
        out.push(`command not found: ${name}`)
    }
    updateTab({
      data: {
        ...state,
        lines: [
          ...state.lines,
          { kind: 'prompt', text: trimmed },
          ...out.map(text => ({ kind: 'out', text })),
        ],
        history: [...state.history, trimmed],
      },
    })
  }

  return (
    <div className="do-pane do-terminal" onClick={() => logRef.current?.querySelector('input')?.focus()}>
      <div className="do-terminal-log" ref={logRef}>
        {state.lines.map((l, i) => (
          <div key={i} className={`do-terminal-line ${l.kind}`}>
            {l.kind === 'prompt' ? (
              <><span className="do-terminal-prompt">$</span> {l.text}</>
            ) : l.text}
          </div>
        ))}
        <div className="do-terminal-line prompt">
          <span className="do-terminal-prompt">$</span>
          <input
            type="text"
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { run(input); setInput('') }
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── DoPanel ───────────────────────────
// Existing browser tabs still open to Wikipedia for continuity; a *new* browser
// tab (added via +) opens the blank New Tab page instead so the user can search
// — the Chrome-style flow.
function makeTab(type, opts = {}) {
  const id = nextId()
  if (type === 'claude') return { id, type, title: 'Claude', data: { messages: [], conversationId: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } }
  if (type === 'browser') {
    const url = opts.newTab
      ? NEW_TAB_URL
      : (opts.url || 'https://en.wikipedia.org/wiki/Main_Page')
    const title = url === NEW_TAB_URL ? 'New Tab' : deriveTitle(url)
    return { id, type, title, data: { url, history: [url], historyIdx: 0, proxy: true } }
  }
  return { id, type: 'terminal', title: 'Terminal', data: { lines: [{ kind: 'out', text: "Innernet shell — type 'help' for commands." }], history: [] } }
}

const STORAGE_KEY = 'innernet:do-panel:v1'

export default function DoPanel() {
  const [tabs, setTabs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.tabs) && parsed.tabs.length) return parsed.tabs
      }
    } catch {}
    return [makeTab('claude'), makeTab('browser'), makeTab('terminal')]
  })
  const [activeId, setActiveId] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)?.activeId || null
    } catch {}
    return null
  })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId })) } catch {}
  }, [tabs, activeId])

  // Keep an active tab selected (first one by default)
  const effectiveActiveId = activeId && tabs.some(t => t.id === activeId) ? activeId : tabs[0]?.id

  const updateTab = (id, patch) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch, data: patch.data ?? t.data } : t))
  }
  const addTab = (type) => {
    const t = makeTab(type, type === 'browser' ? { newTab: true } : {})
    setTabs(prev => [...prev, t])
    setActiveId(t.id)
    setMenuOpen(false)
    logActivity('tab_opened', { source: type, label: `Opened ${type} tab` })
  }
  const closeTab = (id, e) => {
    e?.stopPropagation()
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (id === effectiveActiveId) {
        const fallback = next[idx] || next[idx - 1] || next[0]
        setActiveId(fallback?.id || null)
      }
      return next
    })
  }

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (!e.target.closest?.('.do-newtab-wrap')) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const active = tabs.find(t => t.id === effectiveActiveId)

  return (
    <div className="do-panel">
      <div className="do-tabs">
        <div className="do-tabs-scroll">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`do-tab do-tab-${t.type} ${t.id === effectiveActiveId ? 'active' : ''}`}
              onClick={() => setActiveId(t.id)}
              title={t.title}
            >
              <TabIcon kind={t.type} />
              <span className="do-tab-title">{t.title}</span>
              <span className="do-tab-close" onClick={e => closeTab(t.id, e)} title="Close tab">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </span>
            </button>
          ))}
        </div>
        <div className="do-newtab-wrap">
          <button className="do-newtab" onClick={() => setMenuOpen(o => !o)} title="New tab">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          {menuOpen && (
            <div className="do-newtab-menu" role="menu">
              {TAB_TYPES.map(t => (
                <button key={t.type} className="do-newtab-item" onClick={() => addTab(t.type)}>
                  <TabIcon kind={t.icon} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="do-pane-wrap">
        {active && active.type === 'claude' && (
          <ClaudePane tab={active} updateTab={patch => updateTab(active.id, patch)} />
        )}
        {active && active.type === 'browser' && (
          <BrowserPane tab={active} updateTab={patch => updateTab(active.id, patch)} />
        )}
        {active && active.type === 'terminal' && (
          <TerminalPane tab={active} updateTab={patch => updateTab(active.id, patch)} />
        )}
        {!active && (
          <div className="do-empty">
            <p>No tabs open</p>
            <button onClick={() => addTab('claude')}>Open Claude</button>
          </div>
        )}
      </div>
    </div>
  )
}
