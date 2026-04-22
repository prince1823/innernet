import { useEffect, useMemo, useState } from 'react'
import { getActivity, subscribeActivity } from '../utils/activityLog'
import { askAI } from '../utils/askAI'
import './LogsMode.css'

const SOURCE_META = {
  browser:  { color: '#2563eb', label: 'browser' },
  terminal: { color: '#059669', label: 'terminal' },
  claude:   { color: '#d97706', label: 'claude' },
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}

function parseLabel(ev) {
  const l = ev.label || ''
  if (/^Opened .* tab$/i.test(l)) return { verb: 'opened', obj: `a new ${ev.source} tab`, mono: false }
  if (ev.kind === 'browser_nav') {
    const m = l.match(/^Browsed\s+(.+)$/)
    return { verb: 'visited', obj: m ? m[1] : l, mono: false }
  }
  if (ev.kind === 'terminal_cmd') {
    const m = l.match(/^Ran\s+`([^`]+)`$/)
    return { verb: 'ran', obj: m ? m[1] : l, mono: true }
  }
  if (ev.kind === 'claude_prompt') {
    const m = l.match(/^Asked Claude:\s*"(.+)"$/)
    return { verb: 'asked', obj: m ? `"${m[1]}"` : l, mono: false, italic: true }
  }
  return { verb: '', obj: l, mono: false }
}

// Group events into "paragraphs" separated by gaps >= 4 minutes. Reads like
// natural scene breaks in a journal entry.
function chunkByGap(events, gapMin = 4) {
  const out = []
  let cur = null
  for (const ev of events) {
    if (!cur || ev.ts - cur.endTs > gapMin * 60000) {
      cur = { startTs: ev.ts, endTs: ev.ts, items: [ev] }
      out.push(cur)
    } else {
      cur.items.push(ev)
      cur.endTs = ev.ts
    }
  }
  return out
}

export default function LogsMode({ selectedDate }) {
  const [events, setEvents] = useState(() => getActivity())
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => subscribeActivity(setEvents), [])

  const allDayTimeline = useMemo(() => {
    const day = selectedDate || new Date().toISOString().slice(0, 10)
    return events
      .filter(e => e.date === day)
      .map(e => ({ ts: e.ts, kind: e.kind, label: e.label, source: e.source, id: e.id, url: e.url }))
      .sort((a, b) => a.ts - b.ts)
  }, [events, selectedDate])

  const timeline = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = sourceFilter ? allDayTimeline.filter(e => e.source === sourceFilter) : allDayTimeline
    if (q) out = out.filter(e => (e.label || '').toLowerCase().includes(q) || (e.url || '').toLowerCase().includes(q))
    return out
  }, [allDayTimeline, sourceFilter, query])

  const paragraphs = useMemo(() => chunkByGap(timeline), [timeline])

  const stats = useMemo(() => {
    const c = { browser: 0, terminal: 0, claude: 0 }
    for (const e of allDayTimeline) if (c[e.source] != null) c[e.source]++
    return c
  }, [allDayTimeline])

  const span = useMemo(() => {
    if (timeline.length === 0) return null
    const first = formatTime(timeline[0].ts)
    const last = formatTime(timeline[timeline.length - 1].ts)
    return first === last ? first : `${first} – ${last}`
  }, [timeline])

  const summarize = async () => {
    if (timeline.length === 0) {
      setError('Nothing to summarize yet — open some tabs, run commands, or ask Claude.')
      return
    }
    setLoading(true); setError(''); setSummary('')
    const lines = timeline.map(t => `- ${formatTime(t.ts)} [${t.source}] ${t.label}`).join('\n')
    const prompt = `You are a second-person activity narrator. Given this chronological log of what the user did in their workspace (browser tabs, Claude chats, terminal commands), write a natural-language narrative in the style: "You opened X, then browsed Y, then switched to the terminal and ran Z, then asked Claude about W…". Connect related actions causally where obvious. 3-6 sentences, prose, no bullets.\n\nLog:\n${lines}`
    try {
      const out = await askAI(prompt)
      setSummary(out || '(empty response)')
    } catch (e) {
      setError(e?.message || 'Failed to summarize')
    } finally { setLoading(false) }
  }

  return (
    <div className="logs-mode">
      {error && <div className="logs-mode-error">{error}</div>}

      {summary && (
        <div className="logs-mode-summary">
          <div className="logs-mode-summary-label">AI narrative</div>
          <p>{summary}</p>
        </div>
      )}

      {allDayTimeline.length > 0 && (
        <div className="logs-diary-searchbar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            className="logs-diary-search-input"
            placeholder="Search this day…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="logs-diary-search-clear" onClick={() => setQuery('')} title="Clear search">×</button>
          )}
        </div>
      )}

      {timeline.length === 0 ? (
        <div className="logs-mode-empty">
          {query
            ? <>No matches for <em>"{query}"</em>.</>
            : <>No activity yet. Open a tab, run a command, or ask Claude in <strong>Do</strong>.</>
          }
        </div>
      ) : (
        <article className="logs-diary">
          <header className="logs-diary-head">
            <span className="logs-diary-pills">
              {Object.entries(stats).filter(([, n]) => n > 0).map(([k, n]) => {
                const active = sourceFilter === k
                return (
                  <button
                    type="button"
                    key={k}
                    className={`logs-diary-pill ${active ? 'active' : ''} ${sourceFilter && !active ? 'dim' : ''}`}
                    style={{ '--pill-color': SOURCE_META[k]?.color }}
                    onClick={() => setSourceFilter(active ? null : k)}
                    title={active ? `Showing only ${k}. Click to clear filter.` : `Filter to ${k} only`}
                  >
                    <span className="logs-diary-pill-n">{n}</span>
                    <span>{SOURCE_META[k]?.label || k}</span>
                  </button>
                )
              })}
            </span>
            <button className="logs-mode-btn primary logs-diary-summary-btn" onClick={summarize} disabled={loading}>
              {loading ? 'Summarizing…' : 'AI Summary'}
            </button>
          </header>

          <div className="logs-diary-body">
            {paragraphs.map((p, pi) => (
              <section key={pi} className="logs-diary-scene">
                <aside className="logs-diary-scene-time">
                  {formatTime(p.startTs)}
                  {p.startTs !== p.endTs && <><br/><span>↓</span><br/>{formatTime(p.endTs)}</>}
                </aside>
                <p className="logs-diary-prose">
                  {p.items.map((ev, i) => {
                    const meta = SOURCE_META[ev.source] || { color: '#888', label: ev.source }
                    const { verb, obj, mono, italic } = parseLabel(ev)
                    const connector = i === 0
                      ? (pi === 0 ? 'You ' : 'Then you ')
                      : (i === p.items.length - 1 && p.items.length > 1 ? ', and ' : ', ')
                    return (
                      <span key={ev.id}>
                        {connector}
                        <span className="logs-diary-verb" style={{ color: meta.color }}>{verb}</span>
                        {' '}
                        {ev.url ? (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={`logs-diary-obj link ${mono ? 'mono' : ''} ${italic ? 'italic' : ''}`}
                            style={{ '--obj-color': meta.color }}
                          >
                            {obj}
                          </a>
                        ) : (
                          <span
                            className={`logs-diary-obj ${mono ? 'mono' : ''} ${italic ? 'italic' : ''}`}
                            style={{ '--obj-color': meta.color }}
                          >
                            {obj}
                          </span>
                        )}
                      </span>
                    )
                  })}
                  .
                </p>
              </section>
            ))}
          </div>
        </article>
      )}
    </div>
  )
}
