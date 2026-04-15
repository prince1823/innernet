import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { calendarTasks, eventColors, notes as allNotes, activityLogs, featureDocItems, agentSessions } from '../data/sampleData'
import './CalendarPanel.css'

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function formatTimeDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function formatHourLabel(hour) {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const grid = []
  for (let i = firstDay - 1; i >= 0; i--) grid.push({ day: prevDays - i, inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) grid.push({ day: d, inMonth: true })
  const remaining = 42 - grid.length
  for (let d = 1; d <= remaining; d++) grid.push({ day: d, inMonth: false })
  return grid
}

// Get all events across all dates for search
function getAllEvents() {
  const all = []
  Object.entries(calendarTasks).forEach(([date, events]) => {
    events.forEach(ev => all.push({ ...ev, date }))
  })
  return all
}

// Build concise summary data for an event
function getEventSummaryData(event, dateStr) {
  // Related feature docs
  const features = featureDocItems.filter(f =>
    f.project === event.project ||
    (event.tags && event.tags.some(t => f.title.toLowerCase().includes(t)))
  ).slice(0, 2)

  // Build "planned vs actual" text summary from action items
  let approachSummary = null
  if (event.actionItems) {
    const planned = event.actionItems.flatMap(g => g.tasks.map(t => t.text))
    const done = event.actionItems.flatMap(g => g.tasks.filter(t => t.done).map(t => t.text))
    const notDone = event.actionItems.flatMap(g => g.tasks.filter(t => !t.done).map(t => t.text))
    if (planned.length > 0) {
      const plannedText = planned.slice(0, 2).map(t => t.length > 45 ? t.slice(0, 45) + '...' : t).join('; ')
      const doneText = done.length > 0 ? done.slice(0, 2).map(t => t.length > 45 ? t.slice(0, 45) + '...' : t).join('; ') : 'None yet'
      approachSummary = { plannedText, doneText, doneCount: done.length, totalCount: planned.length }
    }
  }

  // Related agent session — build concise summary
  const agentSession = agentSessions.find(s =>
    s.date === dateStr ||
    (event.tags && event.tags.some(t => s.title.toLowerCase().includes(t)))
  )
  let agentSummary = null
  if (agentSession) {
    agentSummary = agentSession.preview || agentSession.title
  }

  // Activity logs within the event's time window
  const startMin = timeToMinutes(event.time)
  const endMin = timeToMinutes(event.endTime)
  const logs = activityLogs.filter(log => {
    const logMin = timeToMinutes(log.time)
    return logMin >= startMin && logMin < endMin
  })

  return { features, approachSummary, agentSummary, logs }
}

// ── Time Queries ─────────────────────────────────────────────────────────
// Power users can type natural language questions into the search box.
// parseTimeQuery detects the *kind* of question; returns null to fall through
// to the default text search. runTimeQuery computes the answer from the data.

const LOG_DAY = '2026-04-09' // activityLogs[] is a single-day dataset

function parseTimeQuery(rawQuery) {
  const q = rawQuery.toLowerCase().trim()
  if (!q) return null
  // Productivity — "when was i most productive", "most productive", "peak focus"
  if (
    /\b(most|peak|highest|best)\s+(productive|productivity|focused|focus)\b/.test(q) ||
    /\bwhen\b.*\bproductive\b/.test(q) ||
    q === 'productivity' || q === 'most productive'
  ) {
    return { kind: 'productivity' }
  }
  // Time on project — "how much time on colab91", "time on #innernet"
  const timeOn = q.match(/(?:how much time|time)\s+(?:on|in|with)\s+#?([\w-]+)/)
  if (timeOn) return { kind: 'timeOn', project: timeOn[1] }
  // Meetings — "when are my meetings", "show meetings"
  if (
    /\bwhen\b.*\bmeetings?\b/.test(q) ||
    /\bshow\b.*\bmeetings?\b/.test(q) ||
    /\bmy\s+meetings?\b/.test(q) ||
    q === 'meetings'
  ) {
    return { kind: 'meetings' }
  }
  // Free time — "free time", "when am i free", "gaps"
  if (/\bfree\s+time\b/.test(q) || /\bwhen\b.*\bfree\b/.test(q) || /\bgaps?\b/.test(q) || /\bopen\s+time\b/.test(q)) {
    return { kind: 'freeTime' }
  }
  return null
}

// Score an event for productivity. Uses real log/session data for today's
// events and falls back to action-item completion as a cross-day proxy.
function scoreEventProductivity(ev) {
  const startMin = timeToMinutes(ev.time)
  const endMin = timeToMinutes(ev.endTime)
  const duration = endMin - startMin
  let logCount = 0
  let sessionCount = 0
  let userLogCount = 0
  let agentLogCount = 0
  if (ev.date === LOG_DAY) {
    const logs = activityLogs.filter(l => {
      const lm = timeToMinutes(l.time)
      return lm >= startMin && lm < endMin
    })
    logCount = logs.length
    userLogCount = logs.filter(l => l.type === 'user').length
    agentLogCount = logs.filter(l => l.type === 'agent').length
    sessionCount = new Set(logs.map(l => l.session).filter(Boolean)).size
  }
  let doneCount = 0
  let totalAction = 0
  if (ev.actionItems) {
    for (const group of ev.actionItems) {
      for (const task of (group.tasks || [])) {
        totalAction += 1
        if (task.done) doneCount += 1
      }
    }
  }
  // Weighted score: logs are concrete evidence, sessions show AI-assisted
  // work, completed actions show outcome. Duration is a tiebreaker.
  const score = logCount + sessionCount * 3 + doneCount * 2 + duration / 120
  return { score, logCount, userLogCount, agentLogCount, sessionCount, doneCount, totalAction, duration }
}

function runTimeQuery(parsed, currentDateStr) {
  if (parsed.kind === 'productivity') {
    const all = getAllEvents()
    const scored = all
      .map(ev => ({ ev, ...scoreEventProductivity(ev) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
    return { kind: 'productivity', top: scored.slice(0, 5) }
  }
  if (parsed.kind === 'timeOn') {
    const needle = parsed.project.toLowerCase()
    const all = getAllEvents()
    const matches = all.filter(ev =>
      ev.project?.toLowerCase().includes(needle) ||
      ev.tags?.some(t => t.toLowerCase().includes(needle))
    )
    const totalMin = matches.reduce(
      (n, ev) => n + (timeToMinutes(ev.endTime) - timeToMinutes(ev.time)),
      0
    )
    // Group by date for the breakdown
    const byDate = {}
    for (const ev of matches) {
      byDate[ev.date] = (byDate[ev.date] || 0) + (timeToMinutes(ev.endTime) - timeToMinutes(ev.time))
    }
    return { kind: 'timeOn', project: parsed.project, totalMin, events: matches, byDate }
  }
  if (parsed.kind === 'meetings') {
    const all = getAllEvents()
    const meetings = all
      .filter(ev => ev.attendees && ev.attendees.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    return { kind: 'meetings', events: meetings }
  }
  if (parsed.kind === 'freeTime') {
    const dayEvents = [...(calendarTasks[currentDateStr] || [])].sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )
    const DAY_START = 9 * 60
    const DAY_END = 18 * 60
    const gaps = []
    let cursor = DAY_START
    for (const ev of dayEvents) {
      const s = timeToMinutes(ev.time)
      const e = timeToMinutes(ev.endTime)
      if (s > cursor && s - cursor >= 45) gaps.push({ start: cursor, end: s })
      cursor = Math.max(cursor, e)
    }
    if (DAY_END > cursor && DAY_END - cursor >= 45) gaps.push({ start: cursor, end: DAY_END })
    const totalFreeMin = gaps.reduce((n, g) => n + (g.end - g.start), 0)
    return { kind: 'freeTime', gaps, totalFreeMin, dateStr: currentDateStr }
  }
  return null
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default function CalendarPanel({ selectedDate, setSelectedDate, selectedEvent, setSelectedEvent, onSlotClick, quickSlot, thoughts = {}, onDatePanelOpen }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 9))
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(56) // pixels per hour: 42, 56, 84
  const [expandedEvent, setExpandedEvent] = useState(null) // event id for overlay
  const [overlayOrigin, setOverlayOrigin] = useState(null) // { top, left, width, height } for unfold origin
  const [isClosingOverlay, setIsClosingOverlay] = useState(false)
  const [pullProgress, setPullProgress] = useState(0) // -1..1 (negative = prev day pull, positive = next day pull)
  const [dayTransition, setDayTransition] = useState(null) // 'prev' | 'next' during day flip
  const [hoveredEventId, setHoveredEventId] = useState(null) // event id for the hover peek card
  const gridRef = useRef(null)
  const searchRef = useRef(null)
  const panelRef = useRef(null)
  const pullAccum = useRef(0)
  const pullTimer = useRef(null)
  const closeTimeoutRef = useRef(null)
  const hoverTimerRef = useRef(null)

  const dateStr = formatDateStr(currentDate)
  const TODAY_STR = '2026-04-09'
  const NOW_MIN = 10 * 60 + 10 // hardcoded 'now' at 10:10 to match cal-now-line
  const isToday = dateStr === TODAY_STR
  const dayRelation = dateStr < TODAY_STR ? 'past' : dateStr > TODAY_STR ? 'future' : 'today'
  const nowPx = (NOW_MIN / 60) * zoomLevel
  const headerLabel = `${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  const tasks = calendarTasks[dateStr] || []

  // Classify an event's relationship to "now" for the temporal fade/glow treatment
  const getTemporalState = (task) => {
    if (dayRelation === 'past') return 'past'
    if (dayRelation === 'future') return 'future'
    // today — event is past if fully before now, future if fully after, else 'now' (brackets now)
    const start = timeToMinutes(task.time)
    const end = timeToMinutes(task.endTime)
    if (end <= NOW_MIN) return 'past'
    if (start >= NOW_MIN) return 'future'
    return 'now'
  }

  const monthGrid = useMemo(() => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate.getFullYear(), currentDate.getMonth()])

  // Collect thought slots for this date
  const thoughtSlots = useMemo(() => {
    const prefix = `slot-${dateStr}-`
    return Object.keys(thoughts)
      .filter(key => key.startsWith(prefix) && thoughts[key].length > 0)
      .map(key => {
        const time = key.replace(prefix, '')
        const items = thoughts[key]
        return { time, items, label: formatTimeDisplay(time) }
      })
  }, [dateStr, thoughts])

  // Search logic — first tries Time Queries (productivity / time-on / meetings /
  // free-time), then falls back to text search over events.
  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults({ kind: 'empty' })
      return
    }
    // Try time-query intent first
    const parsed = parseTimeQuery(query)
    if (parsed) {
      const result = runTimeQuery(parsed, dateStr)
      if (result) {
        setSearchResults(result)
        return
      }
    }
    const q = query.toLowerCase().trim()
    const allEvents = getAllEvents()
    let filtered

    if (q.startsWith('#')) {
      // Project/tag search
      const tag = q.slice(1)
      filtered = allEvents.filter(ev =>
        ev.project?.toLowerCase().includes(tag) ||
        ev.tags?.some(t => t.toLowerCase().includes(tag))
      )
    } else {
      // Person name or title search
      filtered = allEvents.filter(ev =>
        ev.title?.toLowerCase().includes(q) ||
        ev.attendees?.some(a => a.toLowerCase().includes(q)) ||
        ev.tags?.some(t => t.toLowerCase().includes(q)) ||
        ev.project?.toLowerCase().includes(q)
      )
    }

    // Group by date
    const grouped = {}
    filtered.forEach(ev => {
      if (!grouped[ev.date]) grouped[ev.date] = []
      grouped[ev.date].push(ev)
    })
    setSearchResults({ kind: 'search', grouped })
  }, [dateStr])

  const goToPrev = () => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d })
  const goToNext = () => setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d })
  const goToToday = () => setCurrentDate(new Date(2026, 3, 9))

  const handleMiniCalClick = (day, inMonth) => {
    if (!inMonth) return
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setCurrentDate(d)
    setShowMiniCal(false)
  }

  const handleMiniCalMonthNav = (dir) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1))
  }

  // Resolve the expanded event object and its rich summary for the overlay
  const expandedTask = expandedEvent ? tasks.find(t => t.id === expandedEvent) : null
  const expandedSummary = useMemo(() => {
    if (!expandedTask) return null
    return getEventSummaryData(expandedTask, dateStr)
  }, [expandedTask, dateStr])

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = zoomLevel * 7
  }, [currentDate, zoomLevel])

  useEffect(() => { setSelectedDate(dateStr) }, [dateStr])

  const closeOverlay = useCallback(() => {
    setIsClosingOverlay(true)
    clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setExpandedEvent(null)
      setOverlayOrigin(null)
      setIsClosingOverlay(false)
    }, 220)
  }, [])

  // Hover peek: show a small floating preview card after a short delay
  const handleEventEnter = useCallback((event) => {
    if (expandedEvent) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredEventId(event.id)
    }, 380)
  }, [expandedEvent])

  const handleEventLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current)
    setHoveredEventId(null)
  }, [])

  // Resolve hovered task for peek render
  const hoveredTask = hoveredEventId && !expandedEvent
    ? tasks.find(t => t.id === hoveredEventId)
    : null

  const handleEventClick = (e, event) => {
    e.stopPropagation()
    setSelectedEvent(event)
    if (expandedEvent === event.id) {
      closeOverlay()
      return
    }
    // Cancel any pending close so re-opening a different event doesn't play refold
    clearTimeout(closeTimeoutRef.current)
    setIsClosingOverlay(false)
    const panelRect = panelRef.current?.getBoundingClientRect()
    const blockRect = e.currentTarget.getBoundingClientRect()
    if (panelRect) {
      setOverlayOrigin({
        top: blockRect.top - panelRect.top,
        left: blockRect.left - panelRect.left,
        width: blockRect.width,
        height: blockRect.height,
      })
    }
    setExpandedEvent(event.id)
  }

  // Escape key closes the overlay
  useEffect(() => {
    if (!expandedEvent) return
    const onKey = (e) => { if (e.key === 'Escape') closeOverlay() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expandedEvent, closeOverlay])

  // Infinite scroll days: overscroll at grid boundaries flips the date
  const PULL_THRESHOLD = 140
  const handleGridWheel = useCallback((e) => {
    if (expandedEvent) return // don't flip days while overlay is open
    const scroller = gridRef.current
    if (!scroller) return
    const atTop = scroller.scrollTop <= 0
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1

    if (atTop && e.deltaY < 0) {
      pullAccum.current += e.deltaY // accumulates negative
      if (pullAccum.current <= -PULL_THRESHOLD) {
        setDayTransition('prev')
        setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d })
        pullAccum.current = 0
        setPullProgress(0)
        setTimeout(() => setDayTransition(null), 320)
        return
      }
      setPullProgress(pullAccum.current / PULL_THRESHOLD)
    } else if (atBottom && e.deltaY > 0) {
      pullAccum.current += e.deltaY
      if (pullAccum.current >= PULL_THRESHOLD) {
        setDayTransition('next')
        setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d })
        pullAccum.current = 0
        setPullProgress(0)
        setTimeout(() => setDayTransition(null), 320)
        return
      }
      setPullProgress(pullAccum.current / PULL_THRESHOLD)
    } else {
      if (pullAccum.current !== 0) {
        pullAccum.current = 0
        setPullProgress(0)
      }
    }
    // Decay accumulator if user stops scrolling
    clearTimeout(pullTimer.current)
    pullTimer.current = setTimeout(() => {
      pullAccum.current = 0
      setPullProgress(0)
    }, 240)
  }, [expandedEvent])

  const handleSlotClick = (e) => {
    if (!onSlotClick) return
    const scrollContainer = gridRef.current
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + scrollTop
    const totalMinutes = Math.floor((y / zoomLevel) * 60)
    const hour = Math.floor(totalMinutes / 60)
    const minute = Math.floor(totalMinutes / 30) * 30 % 60
    const clampedHour = Math.max(0, Math.min(23, hour))
    const timeStr = `${String(clampedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    const label = formatTimeDisplay(timeStr)
    onSlotClick(timeStr, label)
  }

  const handleDateClick = () => {
    if (onDatePanelOpen) onDatePanelOpen(dateStr)
  }

  // Jump to a specific date+event from any search result
  const jumpToEvent = (date, ev) => {
    const nd = new Date(date + 'T00:00:00')
    setCurrentDate(nd)
    if (ev) setSelectedEvent(ev)
    setSearchResults(null)
    setSearchQuery('')
  }
  const jumpToDate = (date) => jumpToEvent(date, null)

  // Search results view
  if (searchResults) {
    const kind = searchResults.kind || 'search'
    return (
      <div className="calendar-panel" ref={panelRef}>
        <div className="cal-header">
          <div className="cal-header-left" style={{ flex: 1 }}>
            <div className="cal-search-box active">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Try: when was I most productive?"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
              <button className="cal-search-clear" onClick={() => { setSearchQuery(''); setSearchResults(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div className="cal-search-results">
          {/* Empty / initial state — show suggested time queries */}
          {kind === 'empty' && (
            <div className="cal-query-suggestions">
              <div className="cal-query-suggest-label">Try asking…</div>
              {[
                'When was I most productive?',
                'How much time on innernet?',
                'When are my meetings?',
                'Free time today',
              ].map(s => (
                <button key={s} className="cal-query-suggest-btn" onClick={() => handleSearch(s)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Productivity answer card */}
          {kind === 'productivity' && (() => {
            const top = searchResults.top
            if (!top || top.length === 0) {
              return <div className="cal-search-empty"><p>Not enough data to rank productivity yet.</p></div>
            }
            const winner = top[0]
            const winnerDate = new Date(winner.ev.date + 'T00:00:00')
            const maxScore = winner.score
            return (
              <div className="cal-query-result">
                <div className="cal-query-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span>Productivity analysis</span>
                </div>
                <div className="cal-query-headline">
                  <div className="cal-query-answer-label">Most productive window</div>
                  <div className="cal-query-answer-time">
                    {formatTimeDisplay(winner.ev.time)} – {formatTimeDisplay(winner.ev.endTime)}
                  </div>
                  <div className="cal-query-answer-title">{winner.ev.title}</div>
                  <div className="cal-query-answer-date">
                    {winnerDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="cal-query-metrics">
                  {winner.logCount > 0 && (
                    <div className="cal-query-metric">
                      <span className="cal-query-metric-val">{winner.logCount}</span>
                      <span className="cal-query-metric-label">activity logs</span>
                    </div>
                  )}
                  {winner.sessionCount > 0 && (
                    <div className="cal-query-metric">
                      <span className="cal-query-metric-val">{winner.sessionCount}</span>
                      <span className="cal-query-metric-label">agent {winner.sessionCount === 1 ? 'session' : 'sessions'}</span>
                    </div>
                  )}
                  {winner.doneCount > 0 && (
                    <div className="cal-query-metric">
                      <span className="cal-query-metric-val">{winner.doneCount}/{winner.totalAction}</span>
                      <span className="cal-query-metric-label">tasks done</span>
                    </div>
                  )}
                  <div className="cal-query-metric">
                    <span className="cal-query-metric-val">{formatDuration(winner.duration)}</span>
                    <span className="cal-query-metric-label">focus time</span>
                  </div>
                </div>
                <button className="cal-query-jump" onClick={() => jumpToEvent(winner.ev.date, winner.ev)}>
                  <span>Jump to this window</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
                {top.length > 1 && (
                  <>
                    <div className="cal-query-runners-label">Runner-ups</div>
                    <div className="cal-query-runners">
                      {top.slice(1, 4).map((r, i) => {
                        const d = new Date(r.ev.date + 'T00:00:00')
                        const pct = Math.max(12, Math.round((r.score / maxScore) * 100))
                        const color = eventColors[r.ev.colorIndex] || eventColors[0]
                        return (
                          <button key={r.ev.id + '-' + i} className="cal-query-runner" onClick={() => jumpToEvent(r.ev.date, r.ev)}>
                            <div className="cal-query-runner-bar" style={{ width: `${pct}%`, background: color.border }} />
                            <div className="cal-query-runner-info">
                              <span className="cal-query-runner-title">{r.ev.title}</span>
                              <span className="cal-query-runner-meta">
                                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTimeDisplay(r.ev.time)}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* Time on project answer card */}
          {kind === 'timeOn' && (() => {
            const { project, totalMin, events, byDate } = searchResults
            if (!events || events.length === 0) {
              return <div className="cal-search-empty"><p>No time logged on <strong>{project}</strong>.</p></div>
            }
            const maxDayMin = Math.max(...Object.values(byDate))
            const sortedDates = Object.keys(byDate).sort()
            return (
              <div className="cal-query-result">
                <div className="cal-query-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Time investment</span>
                </div>
                <div className="cal-query-headline">
                  <div className="cal-query-answer-label">Total time on <strong>#{project}</strong></div>
                  <div className="cal-query-answer-time">{formatDuration(totalMin)}</div>
                  <div className="cal-query-answer-title">{events.length} {events.length === 1 ? 'event' : 'events'} across {sortedDates.length} {sortedDates.length === 1 ? 'day' : 'days'}</div>
                </div>
                <div className="cal-query-runners-label">Daily breakdown</div>
                <div className="cal-query-runners">
                  {sortedDates.map(d => {
                    const pct = Math.max(12, Math.round((byDate[d] / maxDayMin) * 100))
                    const label = new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <button key={d} className="cal-query-runner" onClick={() => jumpToDate(d)}>
                        <div className="cal-query-runner-bar" style={{ width: `${pct}%` }} />
                        <div className="cal-query-runner-info">
                          <span className="cal-query-runner-title">{label}</span>
                          <span className="cal-query-runner-meta">{formatDuration(byDate[d])}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Meetings answer card */}
          {kind === 'meetings' && (() => {
            const events = searchResults.events
            if (!events || events.length === 0) {
              return <div className="cal-search-empty"><p>No meetings found.</p></div>
            }
            const totalMin = events.reduce((n, ev) => n + (timeToMinutes(ev.endTime) - timeToMinutes(ev.time)), 0)
            const people = new Set(events.flatMap(ev => ev.attendees || []))
            return (
              <div className="cal-query-result">
                <div className="cal-query-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Meetings</span>
                </div>
                <div className="cal-query-headline">
                  <div className="cal-query-answer-label">Upcoming &amp; past</div>
                  <div className="cal-query-answer-time">{events.length} {events.length === 1 ? 'meeting' : 'meetings'}</div>
                  <div className="cal-query-answer-title">{formatDuration(totalMin)} total · {people.size} {people.size === 1 ? 'person' : 'people'}</div>
                </div>
                <div className="cal-query-runners-label">All meetings</div>
                <div className="cal-query-runners">
                  {events.slice(0, 8).map(ev => {
                    const d = new Date(ev.date + 'T00:00:00')
                    const color = eventColors[ev.colorIndex] || eventColors[0]
                    return (
                      <button key={ev.id} className="cal-query-runner" onClick={() => jumpToEvent(ev.date, ev)}>
                        <div className="cal-query-runner-dot" style={{ background: color.border }} />
                        <div className="cal-query-runner-info">
                          <span className="cal-query-runner-title">{ev.title}</span>
                          <span className="cal-query-runner-meta">
                            {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTimeDisplay(ev.time)}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Free-time answer card */}
          {kind === 'freeTime' && (() => {
            const { gaps, totalFreeMin, dateStr: dStr } = searchResults
            const d = new Date(dStr + 'T00:00:00')
            if (!gaps || gaps.length === 0) {
              return <div className="cal-search-empty"><p>No free blocks of 45+ min on {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.</p></div>
            }
            return (
              <div className="cal-query-result">
                <div className="cal-query-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Free time</span>
                </div>
                <div className="cal-query-headline">
                  <div className="cal-query-answer-label">Open blocks on {d.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                  <div className="cal-query-answer-time">{formatDuration(totalFreeMin)}</div>
                  <div className="cal-query-answer-title">{gaps.length} {gaps.length === 1 ? 'block' : 'blocks'} of 45+ min</div>
                </div>
                <div className="cal-query-runners-label">Blocks</div>
                <div className="cal-query-runners">
                  {gaps.map((g, i) => (
                    <button key={i} className="cal-query-runner" onClick={() => jumpToDate(dStr)}>
                      <div className="cal-query-runner-info">
                        <span className="cal-query-runner-title">
                          {formatTimeDisplay(`${String(Math.floor(g.start/60)).padStart(2,'0')}:${String(g.start%60).padStart(2,'0')}`)} – {formatTimeDisplay(`${String(Math.floor(g.end/60)).padStart(2,'0')}:${String(g.end%60).padStart(2,'0')}`)}
                        </span>
                        <span className="cal-query-runner-meta">{formatDuration(g.end - g.start)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Default text-search results */}
          {kind === 'search' && (() => {
            const grouped = searchResults.grouped || {}
            const dates = Object.keys(grouped).sort()
            if (dates.length === 0) {
              return (
                <div className="cal-search-empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <p>No results found</p>
                </div>
              )
            }
            return dates.map(date => {
              const d = new Date(date + 'T00:00:00')
              return (
                <div key={date} className="cal-search-date-group">
                  <div className="cal-search-date-header">
                    <span className="cal-search-date-day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="cal-search-date-full">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  {grouped[date].map(ev => {
                    const color = eventColors[ev.colorIndex] || eventColors[0]
                    return (
                      <div key={ev.id} className="cal-search-event" onClick={() => jumpToEvent(date, ev)}>
                        <div className="cal-search-event-color" style={{ background: color.border }} />
                        <div className="cal-search-event-info">
                          <span className="cal-search-event-title">{ev.title}</span>
                          <span className="cal-search-event-time">{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                        </div>
                        {ev.attendees && (
                          <div className="cal-search-event-attendees">
                            {ev.attendees.slice(0, 2).map((a, i) => <span key={i} className="cal-search-attendee">{a}</span>)}
                            {ev.attendees.length > 2 && <span className="cal-search-attendee-more">+{ev.attendees.length - 2}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          })()}
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-panel" ref={panelRef}>
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <button className="cal-today-btn" onClick={goToToday}>Today</button>
          <button className="cal-arrow-btn" onClick={goToPrev}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="cal-date-title" onClick={() => setShowMiniCal(!showMiniCal)} style={{ cursor: 'pointer' }}>
            {headerLabel}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 3, opacity: 0.5 }}><polyline points="6 9 12 15 18 9"/></svg>
          </h2>
          <button className="cal-arrow-btn" onClick={goToNext}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="cal-header-right">
          <button className="cal-search-btn" onClick={() => { setSearchResults({ kind: 'empty' }); setTimeout(() => searchRef.current?.focus(), 50) }} title="Search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div className="cal-zoom-btns">
            <button className="cal-zoom-btn" onClick={() => setZoomLevel(z => Math.max(z - 14, 28))} title="Zoom out">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button className="cal-zoom-btn" onClick={() => setZoomLevel(z => Math.min(z + 14, 112))} title="Zoom in">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mini Calendar Dropdown */}
      {showMiniCal && (
        <div className="cal-mini-cal">
          <div className="cal-mini-header">
            <button className="cal-mini-nav" onClick={() => handleMiniCalMonthNav(-1)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="cal-mini-month">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            <button className="cal-mini-nav" onClick={() => handleMiniCalMonthNav(1)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="cal-mini-days-header">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="cal-mini-day-label">{d}</span>)}
          </div>
          <div className="cal-mini-grid">
            {monthGrid.map((cell, i) => {
              const cellDate = cell.inMonth ? formatDateStr(new Date(currentDate.getFullYear(), currentDate.getMonth(), cell.day)) : null
              const hasEvents = cellDate && calendarTasks[cellDate]?.length > 0
              const isSelected = cellDate === dateStr
              const isTodayCell = cellDate === '2026-04-09'
              return (
                <button
                  key={i}
                  className={`cal-mini-cell ${!cell.inMonth ? 'out' : ''} ${isSelected ? 'selected' : ''} ${isTodayCell ? 'today' : ''}`}
                  onClick={() => handleMiniCalClick(cell.day, cell.inMonth)}
                >
                  {cell.day}
                  {hasEvents && <span className="cal-mini-dot" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pull-to-flip hints */}
      {pullProgress < 0 && !expandedEvent && (
        <div className="cal-pull-hint cal-pull-hint--top" style={{ opacity: Math.min(1, -pullProgress), transform: `translateY(${Math.min(0, pullProgress * 8)}px)` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          <span>Keep scrolling for previous day</span>
        </div>
      )}
      {pullProgress > 0 && !expandedEvent && (
        <div className="cal-pull-hint cal-pull-hint--bottom" style={{ opacity: Math.min(1, pullProgress), transform: `translateY(${Math.max(0, pullProgress * 8)}px)` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <span>Keep scrolling for next day</span>
        </div>
      )}

      {/* Time grid */}
      <div className={`cal-grid-scroll ${dayTransition ? `cal-grid-scroll--${dayTransition}` : ''}`} ref={gridRef} onWheel={handleGridWheel}>
        <div
          className={`cal-time-grid cal-time-grid--${dayRelation}`}
          style={{ '--now-px': `${nowPx}px` }}
        >
          <div className="cal-gutter">
            {HOURS.map(hour => (
              <div key={hour} className="cal-time-label" style={{ height: `${zoomLevel}px` }}>
                {hour > 0 && <span>{formatHourLabel(hour)}</span>}
              </div>
            ))}
          </div>

          <div className={`cal-day-col cal-day-col--${dayRelation}`} onClick={handleSlotClick}>
            {HOURS.map(hour => (
              <div key={hour} className="cal-hour-slot" style={{ height: `${zoomLevel}px` }} />
            ))}

            {/* Thought blocks */}
            {thoughtSlots.map(slot => {
              const [h, m] = slot.time.split(':').map(Number)
              const minutes = h * 60 + m
              const topOffset = (minutes / 60) * zoomLevel
              const isActive = quickSlot?.time === slot.time
              return (
                <div key={slot.time} className={`cal-thought-block ${isActive ? 'active' : ''}`} style={{ top: `${topOffset}px` }}
                  onClick={(e) => { e.stopPropagation(); onSlotClick(slot.time, slot.label) }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
                  <span className="cal-thought-preview">{slot.items[slot.items.length - 1].text}</span>
                  {slot.items.length > 1 && <span className="cal-thought-count">+{slot.items.length - 1}</span>}
                </div>
              )
            })}

            {/* Quick slot indicator */}
            {quickSlot && !thoughtSlots.some(s => s.time === quickSlot.time) && (() => {
              const [h, m] = quickSlot.time.split(':').map(Number)
              const minutes = h * 60 + m
              const topOffset = (minutes / 60) * zoomLevel
              return (
                <div className="cal-quick-slot" style={{ top: `${topOffset}px` }}>
                  <div className="cal-quick-slot-label">{quickSlot.label}</div>
                </div>
              )
            })()}

            {/* Event blocks — collapsed: title + time only (progressive disclosure) */}
            {tasks.map((task) => {
              const startMin = timeToMinutes(task.time)
              const endMin = timeToMinutes(task.endTime)
              const duration = endMin - startMin
              const topOffset = (startMin / 60) * zoomLevel
              const height = (duration / 60) * zoomLevel
              const color = eventColors[task.colorIndex] || eventColors[0]
              const isExpanded = expandedEvent === task.id
              const temporal = getTemporalState(task)

              return (
                <div
                  key={task.id}
                  className={`cal-event-block cal-event-block--${temporal} ${selectedEvent?.id === task.id ? 'selected' : ''} ${isExpanded ? 'is-overlay-source' : ''}`}
                  style={{
                    top: `${topOffset}px`,
                    minHeight: `${Math.max(height, 24)}px`,
                    height: `${Math.max(height, 24)}px`,
                    backgroundColor: color.bg,
                    borderLeft: `4px solid ${color.border}`,
                  }}
                  onClick={(e) => handleEventClick(e, task)}
                  onMouseEnter={() => handleEventEnter(task)}
                  onMouseLeave={handleEventLeave}
                >
                  <span className="cal-event-title" style={{ color: color.text }}>{task.title}</span>
                  <span className="cal-event-time" style={{ color: color.text }}>
                    {formatTimeDisplay(task.time)} – {formatTimeDisplay(task.endTime)}
                  </span>
                </div>
              )
            })}

            {/* Hover peek card — small floating preview on event hover */}
            {hoveredTask && (() => {
              const startMin = timeToMinutes(hoveredTask.time)
              const endMin = timeToMinutes(hoveredTask.endTime)
              const blockTop = (startMin / 60) * zoomLevel
              const blockHeight = Math.max(24, ((endMin - startMin) / 60) * zoomLevel)
              const blockBottom = blockTop + blockHeight
              // Pick first undone task, or fall back to first task
              const allTasks = (hoveredTask.actionItems || []).flatMap(g => g.tasks || [])
              const keyTask = allTasks.find(t => !t.done) || allTasks[0]
              // Prefer placing above the event; flip below if too close to top
              const placement = blockTop >= 120 ? 'above' : 'below'
              const top = placement === 'above' ? blockTop - 8 : blockBottom + 8
              const color = eventColors[hoveredTask.colorIndex] || eventColors[0]
              return (
                <div
                  className={`cal-peek cal-peek--${placement}`}
                  style={{ top: `${top}px`, borderLeftColor: color.border }}
                  onMouseEnter={() => clearTimeout(hoverTimerRef.current)}
                  onMouseLeave={handleEventLeave}
                >
                  <div className="cal-peek-head">
                    <span className="cal-peek-title">{hoveredTask.title}</span>
                    <span className="cal-peek-time">{formatTimeDisplay(hoveredTask.time)} – {formatTimeDisplay(hoveredTask.endTime)}</span>
                  </div>
                  {hoveredTask.aiSummary && (
                    <div className="cal-peek-ai">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <span>{hoveredTask.aiSummary}</span>
                    </div>
                  )}
                  {keyTask && (
                    <div className={`cal-peek-task ${keyTask.done ? 'done' : ''}`}>
                      <span className="cal-peek-task-dot" />
                      <span className="cal-peek-task-text">{keyTask.text}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Current time line */}
            {isToday && (
              <div className="cal-now-line" style={{ top: `${((10 * 60 + 10) / 60) * zoomLevel}px` }}>
                <div className="cal-now-dot" />
                <div className="cal-now-rule" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Detail Overlay — unfolds from clicked event, splits into Summary | Activity */}
      {expandedTask && expandedSummary && overlayOrigin && (() => {
        const pw = panelRef.current?.offsetWidth || 0
        const ph = panelRef.current?.offsetHeight || 0
        const style = {
          '--origin-top': `${overlayOrigin.top}px`,
          '--origin-left': `${overlayOrigin.left}px`,
          '--origin-right': `${Math.max(0, pw - overlayOrigin.left - overlayOrigin.width)}px`,
          '--origin-bottom': `${Math.max(0, ph - overlayOrigin.top - overlayOrigin.height)}px`,
          '--origin-width': `${overlayOrigin.width}px`,
          '--origin-height': `${overlayOrigin.height}px`,
          '--origin-bg': eventColors[expandedTask.colorIndex]?.bg || eventColors[0].bg,
          '--origin-border': eventColors[expandedTask.colorIndex]?.border || eventColors[0].border,
        }
        const color = eventColors[expandedTask.colorIndex] || eventColors[0]
        return (
          <div className={`cal-overlay-root ${isClosingOverlay ? 'is-closing' : 'is-opening'}`} style={style}>
            <div className="cal-overlay-backdrop" onClick={closeOverlay} />
            <div className="cal-overlay-card" style={{ borderLeftColor: color.border }}>
              <div className="cal-overlay-header">
                <div className="cal-overlay-header-text">
                  <div className="cal-overlay-title">{expandedTask.title}</div>
                  <div className="cal-overlay-sub">
                    <span>{formatTimeDisplay(expandedTask.time)} – {formatTimeDisplay(expandedTask.endTime)}</span>
                    {expandedTask.project && <span className="cal-overlay-dot">·</span>}
                    {expandedTask.project && <span className="cal-overlay-project">#{expandedTask.project}</span>}
                  </div>
                </div>
                <button className="cal-overlay-close" onClick={closeOverlay} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="cal-overlay-split">
                {/* LEFT: Summary */}
                <div className="cal-overlay-col cal-overlay-col--left">
                  <div className="cal-overlay-col-title">Summary</div>
                  <div className="cal-overlay-col-body">
                    {expandedTask.aiSummary && (
                      <div className="cal-overlay-block cal-overlay-block--ai">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <p>{expandedTask.aiSummary}</p>
                      </div>
                    )}
                    {expandedSummary.approachSummary && (
                      <div className="cal-overlay-block">
                        <div className="cal-overlay-label">Approach</div>
                        <p className="cal-overlay-ptext"><strong>Planned:</strong> {expandedSummary.approachSummary.plannedText}</p>
                        <p className="cal-overlay-ptext"><strong>Done:</strong> {expandedSummary.approachSummary.doneText}</p>
                        <div className="cal-overlay-progress">
                          <div className="cal-overlay-progress-bar" style={{ width: `${(expandedSummary.approachSummary.doneCount / expandedSummary.approachSummary.totalCount) * 100}%` }} />
                          <span>{expandedSummary.approachSummary.doneCount}/{expandedSummary.approachSummary.totalCount}</span>
                        </div>
                      </div>
                    )}
                    {expandedSummary.features.length > 0 && (
                      <div className="cal-overlay-block">
                        <div className="cal-overlay-label">Feature Docs</div>
                        {expandedSummary.features.map(f => (
                          <div key={f.id} className="cal-overlay-feat">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span>{f.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {expandedSummary.agentSummary && (
                      <div className="cal-overlay-block">
                        <div className="cal-overlay-label">Agent Session</div>
                        <p className="cal-overlay-ptext cal-overlay-ptext--italic">{expandedSummary.agentSummary}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cal-overlay-divider" />

                {/* RIGHT: Activity logs */}
                <div className="cal-overlay-col cal-overlay-col--right">
                  <div className="cal-overlay-col-title">Activity</div>
                  <div className="cal-overlay-col-body">
                    {expandedSummary.logs.length === 0 ? (
                      <div className="cal-overlay-empty">No activity logged during this event</div>
                    ) : (
                      <div className="cal-overlay-logs">
                        {expandedSummary.logs.map(log => (
                          <div key={log.id} className={`cal-overlay-log cal-overlay-log--${log.type}`}>
                            <span className="cal-overlay-log-time">{formatTimeDisplay(log.time)}</span>
                            <span className={`cal-overlay-log-dot cal-overlay-log-dot--${log.type}`} />
                            <span className="cal-overlay-log-action">{log.action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
