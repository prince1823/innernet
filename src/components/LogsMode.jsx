import { useEffect, useMemo, useState } from 'react'
import { getActivity, subscribeActivity } from '../utils/activityLog'
import { askAI } from '../utils/askAI'
import './LogsMode.css'

const KIND_META = {
  tab_opened:    { dot: '#9c8cfc', label: 'tab' },
  claude_prompt: { dot: '#f59e0b', label: 'claude' },
  browser_nav:   { dot: '#42a5f5', label: 'browser' },
  terminal_cmd:  { dot: '#26a69a', label: 'terminal' },
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function LogsMode({ selectedDate }) {
  const [events, setEvents] = useState(() => getActivity())
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => subscribeActivity(setEvents), [])

  const timeline = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events
      .filter(e => e.date === today)
      .map(e => ({ ts: e.ts, kind: e.kind, label: e.label, source: e.source, id: e.id }))
      .sort((a, b) => a.ts - b.ts)
  }, [events])

  const summarize = async () => {
    if (timeline.length === 0) {
      setError('Nothing to summarize yet — open some tabs, run commands, or ask Claude.')
      return
    }
    setLoading(true)
    setError('')
    setSummary('')
    const lines = timeline.map(t => `- ${formatTime(t.ts)} [${KIND_META[t.kind]?.label || t.kind}] ${t.label}`).join('\n')
    const prompt = `You are a second-person activity narrator. Given this chronological log of what the user did in their workspace (browser tabs, Claude chats, terminal commands), write a natural-language narrative in the style: "You opened X, then browsed Y, then switched to the terminal and ran Z, then asked Claude about W…". Connect related actions causally where obvious. 3-6 sentences, prose, no bullets.\n\nLog:\n${lines}`
    try {
      const out = await askAI(prompt)
      setSummary(out || '(empty response)')
    } catch (e) {
      setError(e?.message || 'Failed to summarize')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="logs-mode">
      <div className="logs-mode-header">
        <div>
          <h2 className="logs-mode-title">Activity Log</h2>
          <p className="logs-mode-sub">An AI-narrated trace of what you did in Do today</p>
        </div>
        <div className="logs-mode-actions">
          <button className="logs-mode-btn primary" onClick={summarize} disabled={loading}>
            {loading ? 'Summarizing…' : 'AI Summary'}
          </button>
        </div>
      </div>

      {error && <div className="logs-mode-error">{error}</div>}

      {summary && (
        <div className="logs-mode-summary">
          <div className="logs-mode-summary-label">AI narrative</div>
          <p>{summary}</p>
        </div>
      )}

      {timeline.length === 0 ? (
        <div className="logs-mode-empty">
          No activity yet for this date. Switch to <strong>Do</strong> and open a tab, run a command, or ask Claude — events appear here.
        </div>
      ) : (
        <ul className="logs-mode-timeline">
          {timeline.map((t, i) => {
            const meta = KIND_META[t.kind] || { dot: '#999', label: t.kind }
            return (
              <li key={t.id || i} className="logs-mode-row">
                <span className="logs-mode-time">{formatTime(t.ts)}</span>
                <span className="logs-mode-dot-col">
                  <span className="logs-mode-dot" style={{ background: meta.dot }} />
                  {i < timeline.length - 1 && <span className="logs-mode-line" />}
                </span>
                <span className="logs-mode-body">
                  <span className="logs-mode-tag" style={{ color: meta.dot }}>{meta.label}</span>
                  <span className="logs-mode-label">{t.label}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
