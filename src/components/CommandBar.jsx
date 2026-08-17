import { useState, useRef, useEffect, useCallback } from 'react'
import { calendarTasks, eventColors, activityLogs } from '../data/sampleData'
import { parseEventWithAI } from '../utils/parseEventAI'
import './CommandBar.css'

// ── Shared Helpers ──────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const LOG_DAY = '2026-04-09'

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

function addMinutesToTimeStr(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.min(23, Math.floor(total / 60))
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function capitalizeWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function minutesToTimeStr(total) {
  const h = Math.max(0, Math.min(23, Math.floor(total / 60)))
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Finds the first working-hours (9am-6pm) gap of at least `durationMin` on
// `dateStr`, skipping over existing events. Returns a "HH:MM" start time, or
// null if the day has no gap that large left.
function findFirstFreeSlot(dateStr, durationMin, userEvents) {
  const dayEvents = [...(calendarTasks[dateStr] || []), ...((userEvents && userEvents[dateStr]) || [])].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
  const DAY_START = 9 * 60, DAY_END = 18 * 60
  let cursor = DAY_START
  for (const ev of dayEvents) {
    const s = timeToMinutes(ev.time), e = timeToMinutes(ev.endTime)
    if (s > cursor && s - cursor >= durationMin) return minutesToTimeStr(cursor)
    cursor = Math.max(cursor, e)
  }
  if (DAY_END - cursor >= durationMin) return minutesToTimeStr(cursor)
  return null
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function getAllEvents(userEvents = {}) {
  const all = []
  Object.entries(calendarTasks).forEach(([date, events]) => {
    events.forEach(ev => all.push({ ...ev, date }))
  })
  Object.entries(userEvents).forEach(([date, events]) => {
    events.forEach(ev => all.push({ ...ev, date }))
  })
  return all
}

// ── Natural-language Scheduling ─────────────────────────────────────────

function parseDateFromText(q, todayStr) {
  const today = new Date(todayStr + 'T00:00:00')
  if (/\btoday\b/.test(q)) return formatDateStr(today)
  if (/\btomorrow\b/.test(q)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return formatDateStr(d)
  }
  const wdMatch = q.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
  if (wdMatch) {
    const targetIdx = WEEKDAYS.indexOf(wdMatch[2])
    const next = !!wdMatch[1]
    const d = new Date(today)
    let diff = (targetIdx - d.getDay() + 7) % 7
    if (diff === 0) diff = 7
    if (next) diff += 7
    d.setDate(d.getDate() + diff)
    return formatDateStr(d)
  }
  const dayFirst = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/)
  const monthFirst = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/)
  let day = null, monthName = null
  if (dayFirst) { day = parseInt(dayFirst[1], 10); monthName = dayFirst[2] }
  else if (monthFirst) { day = parseInt(monthFirst[2], 10); monthName = monthFirst[1] }
  if (day != null && monthName != null) {
    const monthIdx = MONTH_MAP[monthName]
    if (monthIdx != null && day >= 1 && day <= 31) {
      return formatDateStr(new Date(today.getFullYear(), monthIdx, day))
    }
  }
  return null
}

function parseTimeFromText(q) {
  const m12 = q.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const mm = m12[2] ? parseInt(m12[2], 10) : 0
    const period = m12[3]
    if (h < 1 || h > 12 || mm > 59) return null
    if (period === 'pm' && h !== 12) h += 12
    if (period === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  const m24 = q.match(/\bat\s+(\d{1,2}):(\d{2})\b/) || q.match(/\b(\d{1,2}):(\d{2})\b/)
  if (m24) {
    const h = parseInt(m24[1], 10)
    const mm = parseInt(m24[2], 10)
    if (h <= 23 && mm <= 59) return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  return null
}

const EVENT_TYPE_RE = /\b(meeting|call|sync|standup|catchup|catch[- ]up|chat|1:1|one[- ]on[- ]one|interview|review|lunch|coffee|event)\b/

function parseScheduleQuery(rawQuery, todayStr) {
  const q = rawQuery.toLowerCase().trim()
  if (!q) return null
  const hasIntent = /^(schedule|add|create|book|set\s*up|new)\b/.test(q) ||
    (/(schedule|book|add|create)/.test(q) && EVENT_TYPE_RE.test(q))
  if (!hasIntent) return null
  const typeMatch = q.match(EVENT_TYPE_RE)
  const type = typeMatch ? typeMatch[1].replace(/[- ]/g, ' ') : 'meeting'
  let attendees = []
  const withMatch = q.match(/\bwith\s+(.+?)(?=\s+(?:on|at|for|about|tomorrow|today|next|this|from)\b|\s+\d|$)/)
  if (withMatch) {
    attendees = withMatch[1]
      .split(/,|\band\b|&/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => name.split(/\s+/).map(capitalizeWord).join(' '))
  }
  const date = parseDateFromText(q, todayStr)
  const time = parseTimeFromText(q)
  if (!date || !time) return null
  return { type, attendees, date, time }
}

// ── Time Queries ────────────────────────────────────────────────────────

function parseTimeQuery(rawQuery) {
  const q = rawQuery.toLowerCase().trim()
  if (!q) return null
  if (
    /\b(most|peak|highest|best)\s+(productive|productivity|focused|focus)\b/.test(q) ||
    /\bwhen\b.*\bproductive\b/.test(q) ||
    q === 'productivity' || q === 'most productive'
  ) return { kind: 'productivity' }
  const timeOn = q.match(/(?:how much time|time)\s+(?:on|in|with)\s+#?([\w-]+)/)
  if (timeOn) return { kind: 'timeOn', project: timeOn[1] }
  if (
    /\bwhen\b.*\bmeetings?\b/.test(q) ||
    /\bshow\b.*\bmeetings?\b/.test(q) ||
    /\bmy\s+meetings?\b/.test(q) ||
    q === 'meetings'
  ) return { kind: 'meetings' }
  if (/\bfree\s+time\b/.test(q) || /\bwhen\b.*\bfree\b/.test(q) || /\bgaps?\b/.test(q) || /\bopen\s+time\b/.test(q)) {
    return { kind: 'freeTime' }
  }
  return null
}

function scoreEventProductivity(ev) {
  const startMin = timeToMinutes(ev.time)
  const endMin = timeToMinutes(ev.endTime)
  const duration = endMin - startMin
  let logCount = 0, sessionCount = 0, userLogCount = 0, agentLogCount = 0
  if (ev.date === LOG_DAY) {
    const logs = activityLogs.filter(l => { const lm = timeToMinutes(l.time); return lm >= startMin && lm < endMin })
    logCount = logs.length
    userLogCount = logs.filter(l => l.type === 'user').length
    agentLogCount = logs.filter(l => l.type === 'agent').length
    sessionCount = new Set(logs.map(l => l.session).filter(Boolean)).size
  }
  let doneCount = 0, totalAction = 0
  if (ev.actionItems) {
    for (const group of ev.actionItems) {
      for (const task of (group.tasks || [])) { totalAction += 1; if (task.done) doneCount += 1 }
    }
  }
  const score = logCount + sessionCount * 3 + doneCount * 2 + duration / 120
  return { score, logCount, userLogCount, agentLogCount, sessionCount, doneCount, totalAction, duration }
}

function runTimeQuery(parsed, currentDateStr, userEvents = {}) {
  if (parsed.kind === 'productivity') {
    const all = getAllEvents(userEvents)
    const scored = all.map(ev => ({ ev, ...scoreEventProductivity(ev) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score)
    return { kind: 'productivity', top: scored.slice(0, 5) }
  }
  if (parsed.kind === 'timeOn') {
    const needle = parsed.project.toLowerCase()
    const all = getAllEvents(userEvents)
    const matches = all.filter(ev => ev.project?.toLowerCase().includes(needle) || ev.tags?.some(t => t.toLowerCase().includes(needle)))
    const totalMin = matches.reduce((n, ev) => n + (timeToMinutes(ev.endTime) - timeToMinutes(ev.time)), 0)
    const byDate = {}
    for (const ev of matches) { byDate[ev.date] = (byDate[ev.date] || 0) + (timeToMinutes(ev.endTime) - timeToMinutes(ev.time)) }
    return { kind: 'timeOn', project: parsed.project, totalMin, events: matches, byDate }
  }
  if (parsed.kind === 'meetings') {
    const all = getAllEvents(userEvents)
    const meetings = all.filter(ev => ev.attendees && ev.attendees.length > 0).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    return { kind: 'meetings', events: meetings }
  }
  if (parsed.kind === 'freeTime') {
    const dayEvents = [...(calendarTasks[currentDateStr] || []), ...((userEvents && userEvents[currentDateStr]) || [])].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    const DAY_START = 9 * 60, DAY_END = 18 * 60
    const gaps = []
    let cursor = DAY_START
    for (const ev of dayEvents) {
      const s = timeToMinutes(ev.time), e = timeToMinutes(ev.endTime)
      if (s > cursor && s - cursor >= 45) gaps.push({ start: cursor, end: s })
      cursor = Math.max(cursor, e)
    }
    if (DAY_END > cursor && DAY_END - cursor >= 45) gaps.push({ start: cursor, end: DAY_END })
    const totalFreeMin = gaps.reduce((n, g) => n + (g.end - g.start), 0)
    return { kind: 'freeTime', gaps, totalFreeMin, dateStr: currentDateStr }
  }
  return null
}

// ── Component ───────────────────────────────────────────────────────────

export default function CommandBar({ onScheduleEvent, existingEvents = {}, userEvents = {}, dateStr, onJumpToDate, onSearchResults, searchQuery: externalSearchQuery, onSearchQueryChange }) {
  const TODAY_STR = (() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('search') // 'search' | 'ai'
  const [messages, setMessages] = useState([])
  const [pendingEvent, setPendingEvent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const barRef = useRef(null)
  const panelRef = useRef(null)
  const resizeRef = useRef(null)

  // Scroll AI messages into view
  useEffect(() => {
    if (mode === 'ai' && expanded) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, mode, expanded])

  // Close AI panel on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (mode === 'ai' && expanded) { setExpanded(false); return }
        if (mode === 'search' && externalSearchQuery) { onSearchResults(null); onSearchQueryChange(''); setQuery('') }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded, mode, externalSearchQuery])

  // Reset inline resize style when panel collapses
  useEffect(() => {
    if (!expanded && barRef.current) {
      barRef.current.style.flex = ''
    }
  }, [expanded])

  // Click outside to collapse AI panel
  useEffect(() => {
    if (!expanded || mode !== 'ai') return
    const onClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setExpanded(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [expanded, mode])

  // ── Mode Toggle ──

  const switchMode = (newMode) => {
    // Reset any inline resize style from dragging
    if (barRef.current) barRef.current.style.flex = ''
    setMode(newMode)
    setQuery('')
    if (newMode === 'search') {
      setExpanded(false)
      onSearchResults(null)
      onSearchQueryChange('')
    } else {
      // Clear search results first, then expand AI panel after a frame
      // to avoid simultaneous layout shift
      onSearchResults(null)
      onSearchQueryChange('')
      requestAnimationFrame(() => setExpanded(true))
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── Search Logic (results rendered by CalendarPanel) ──

  const handleSearch = useCallback((q) => {
    setQuery(q)
    onSearchQueryChange(q)
    if (!q.trim()) {
      onSearchResults(null)
      return
    }
    const parsed = parseTimeQuery(q)
    if (parsed) {
      const result = runTimeQuery(parsed, dateStr, userEvents)
      if (result) { onSearchResults(result); return }
    }
    const ql = q.toLowerCase().trim()
    const allEvents = getAllEvents(userEvents)
    let filtered
    if (ql.startsWith('#')) {
      const tag = ql.slice(1)
      filtered = allEvents.filter(ev => ev.project?.toLowerCase().includes(tag) || ev.tags?.some(t => t.toLowerCase().includes(tag)))
    } else {
      filtered = allEvents.filter(ev =>
        ev.title?.toLowerCase().includes(ql) ||
        ev.attendees?.some(a => a.toLowerCase().includes(ql)) ||
        ev.tags?.some(t => t.toLowerCase().includes(ql)) ||
        ev.project?.toLowerCase().includes(ql)
      )
    }
    const grouped = {}
    filtered.forEach(ev => { if (!grouped[ev.date]) grouped[ev.date] = []; grouped[ev.date].push(ev) })
    onSearchResults({ kind: 'search', grouped })
  }, [dateStr, userEvents, onSearchResults, onSearchQueryChange])

  const commitSearch = useCallback((q) => {
    const schedule = parseScheduleQuery(q || '', TODAY_STR)
    if (!schedule || !onScheduleEvent) return false
    const endTime = addMinutesToTimeStr(schedule.time, 60)
    const typeTitle = schedule.type.split(' ').map(w => w === '1:1' ? '1:1' : capitalizeWord(w)).join(' ')
    const title = schedule.attendees.length ? `${typeTitle} with ${schedule.attendees.join(', ')}` : typeTitle
    const newEvent = {
      id: `U-${Date.now().toString(36)}`,
      title, time: schedule.time, endTime, colorIndex: 4, tags: [], attendees: schedule.attendees, userCreated: true,
    }
    onScheduleEvent(schedule.date, newEvent)
    onSearchResults({ kind: 'scheduled', event: newEvent, date: schedule.date, endTime })
    return true
  }, [onScheduleEvent, onSearchResults])

  // ── AI Schedule ──

  const detectConflicts = (date, time, endTime) => {
    if (!date || !time || !endTime) return []
    const dayEvents = existingEvents[date] || []
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const newStart = toMin(time), newEnd = toMin(endTime)
    return dayEvents.filter(ev => {
      const evStart = toMin(ev.time), evEnd = toMin(ev.endTime)
      return newStart < evEnd && newEnd > evStart
    })
  }

  const handleAISend = async () => {
    const text = query.trim()
    if (!text || loading) return

    setQuery('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setExpanded(true)
    setLoading(true)

    try {
      const result = await parseEventWithAI(text, TODAY_STR, pendingEvent)
      if (result.error) {
        setMessages(prev => [...prev, { role: 'error', content: result.error }])
        return
      }
      if (result.action === 'update' && pendingEvent) {
        const updated = { ...pendingEvent, ...result }
        delete updated.action
        setPendingEvent(updated)
        setMessages(prev => [...prev, { role: 'event-card', data: updated, isUpdate: true }])
      } else {
        const eventData = { ...result }
        delete eventData.action
        if (!eventData.duration) eventData.duration = 60
        setPendingEvent(eventData)
        setMessages(prev => [...prev, { role: 'event-card', data: eventData }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    if (!pendingEvent) return
    if (!pendingEvent.date) {
      setMessages(prev => [...prev, { role: 'error', content: 'This event needs a date before it can be created — try typing e.g. "move to Friday".' }])
      return
    }
    const duration = pendingEvent.duration || 60
    // No time specified — auto-pick the first open working-hours slot on that
    // date instead of blocking on the user to type one.
    let time = pendingEvent.time
    let autoPicked = false
    if (!time) {
      time = findFirstFreeSlot(pendingEvent.date, duration, userEvents)
      if (!time) {
        const dayLabel = new Date(pendingEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
        setMessages(prev => [...prev, { role: 'error', content: `No open ${duration}-min slot on ${dayLabel} between 9 AM–6 PM — try typing e.g. "make it 2pm" or pick another day.` }])
        return
      }
      autoPicked = true
    }
    const endTime = addMinutesToTimeStr(time, duration)
    const title = pendingEvent.title ||
      (pendingEvent.attendees?.length ? `Meeting with ${pendingEvent.attendees.join(', ')}` : pendingEvent.eventType || 'Event')
    const newEvent = {
      id: `AI-${Date.now().toString(36)}`,
      title, time, endTime, colorIndex: 4, tags: [],
      attendees: pendingEvent.attendees || [], userCreated: true,
      location: pendingEvent.location || null, description: pendingEvent.description || null,
    }
    onScheduleEvent(pendingEvent.date, newEvent)
    const dateObj = new Date(pendingEvent.date + 'T00:00:00')
    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    const successId = Date.now()
    setMessages(prev => [...prev, {
      role: 'success', id: successId, title,
      timeRange: `${formatTimeDisplay(time)} – ${formatTimeDisplay(endTime)}${autoPicked ? ' (first open slot)' : ''}`,
      dateLabel, date: pendingEvent.date,
    }])
    setPendingEvent(null)
    setTimeout(() => { setMessages(prev => prev.map(m => m.id === successId ? { ...m, fading: true } : m)) }, 2500)
    setTimeout(() => { setMessages(prev => prev.filter(m => m.id !== successId)) }, 3000)
  }

  const handleCancel = () => {
    // Mark the latest event card as cancelled before clearing pendingEvent
    setMessages(prev => prev.map((m, i) => {
      if (m.role === 'event-card') {
        const isLatest = !prev.slice(i + 1).some(x => x.role === 'event-card')
        if (isLatest) return { ...m, cancelled: true }
      }
      return m
    }))
    setPendingEvent(null)
    setMessages(prev => [...prev, { role: 'system', content: 'Event cancelled. Type something new to schedule.' }])
  }

  // ── Input Dispatch ──

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'search') {
        commitSearch(query)
        return
      }
      // AI mode
      if (pendingEvent) { handleAISend(); return }
      handleAISend()
    }
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (mode === 'search') {
      handleSearch(val)
    }
    // In AI mode, just update query — no live action
  }

  const handleFocus = () => {
    if (mode === 'ai' && !expanded) {
      setExpanded(true)
    }
  }

  // ── Panel Resize ──

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const cmdbar = barRef.current
    if (!cmdbar) return
    const startY = e.clientY
    const startHeight = cmdbar.offsetHeight
    const parentHeight = cmdbar.parentElement?.offsetHeight || window.innerHeight
    resizeRef.current = { startY, startHeight, parentHeight }

    const onMove = (me) => {
      const r = resizeRef.current
      if (!r) return
      // Dragging UP increases height (panel grows upward)
      const delta = r.startY - me.clientY
      const minH = 120
      const maxH = r.parentHeight - 50 // leave room for header
      const newHeight = Math.max(minH, Math.min(maxH, r.startHeight + delta))
      cmdbar.style.flex = `0 0 ${newHeight}px`
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      resizeRef.current = null
    }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────

  const showAIPanel = mode === 'ai' && expanded

  return (
    <div className={`cmdbar ${showAIPanel ? 'cmdbar--expanded' : ''}`} ref={barRef}>
      {/* AI Messages Panel — floats above the input bar */}
      {showAIPanel && (
        <div className="cmdbar-panel-wrapper" ref={panelRef}>
          <div className="cmdbar-resize-handle" onMouseDown={handleResizeStart} />
          <div className="cmdbar-panel">
          {messages.length === 0 && (
            <div className="cmdbar-ai-welcome">
              <div className="cmdbar-ai-welcome-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <p className="cmdbar-ai-welcome-text">Type anything to schedule an event</p>
              <div className="cmdbar-ai-examples">
                {[
                  'Meeting with Tanuj tomorrow at 3pm',
                  'Book a 90min design review on Friday at the office',
                  'Weekly standup every Monday 10am with the team',
                  'Block 2 hours for deep work tomorrow afternoon',
                ].map(ex => (
                  <button key={ex} className="cmdbar-ai-example" onClick={() => { setQuery(ex); inputRef.current?.focus() }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`cmdbar-msg cmdbar-msg--${msg.role}`}>
              {msg.role === 'user' && <div className="cmdbar-msg-user">{msg.content}</div>}
              {msg.role === 'error' && <div className="cmdbar-msg-error">{msg.content}</div>}
              {msg.role === 'system' && <div className="cmdbar-msg-system">{msg.content}</div>}

              {msg.role === 'success' && (
                <div className={`cmdbar-msg-success ${msg.fading ? 'cmdbar-msg-success--out' : ''}`}>
                  <div className="cmdbar-msg-success-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div className="cmdbar-msg-success-label">Event created</div>
                  <div className="cmdbar-msg-success-title">{msg.title}</div>
                  <div className="cmdbar-msg-success-meta">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>{msg.dateLabel}</span>
                    <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{msg.timeRange}</span>
                  </div>
                </div>
              )}

              {msg.role === 'event-card' && (() => {
                const ev = msg.data
                const isLatestCard = i === messages.length - 1 || !messages.slice(i + 1).some(m => m.role === 'event-card')
                const isPending = isLatestCard && !!pendingEvent
                const endTime = ev.time ? addMinutesToTimeStr(ev.time, ev.duration || 60) : null
                const conflicts = isPending && ev.date && ev.time && endTime ? detectConflicts(ev.date, ev.time, endTime) : []
                const dateObj = ev.date ? new Date(ev.date + 'T00:00:00') : null
                const dateLabel = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not set'
                const isCreated = !pendingEvent && !msg.cancelled
                return (
                  <div className={`cmdbar-event-card ${msg.isUpdate ? 'cmdbar-event-card--updated' : ''} ${isCreated ? 'cmdbar-event-card--created' : ''}`}>
                    {msg.isUpdate && !isCreated && <div className="cmdbar-event-card-badge">Updated</div>}
                    {isCreated && <div className="cmdbar-event-card-badge cmdbar-event-card-badge--created">Created</div>}
                    <div className="cmdbar-event-card-title">{ev.title || 'Untitled Event'}</div>
                    <div className="cmdbar-event-card-rows">
                      <div className="cmdbar-event-card-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>{dateLabel}</span>
                      </div>
                      {ev.time && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>{formatTimeDisplay(ev.time)} – {formatTimeDisplay(endTime)}</span>
                          <span className="cmdbar-event-card-duration">{ev.duration || 60} min</span>
                        </div>
                      )}
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          <span>{ev.attendees.join(', ')}</span>
                        </div>
                      )}
                      {ev.location && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span>{ev.location}</span>
                        </div>
                      )}
                      {ev.description && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                          <span>{ev.description}</span>
                        </div>
                      )}
                      {ev.recurrence && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                          <span>Repeats {ev.recurrence.type}{ev.recurrence.interval > 1 ? ` every ${ev.recurrence.interval}` : ''}</span>
                        </div>
                      )}
                      {ev.reminder && (
                        <div className="cmdbar-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                          <span>{ev.reminder} min before</span>
                        </div>
                      )}
                    </div>
                    {conflicts.length > 0 && (
                      <div className="cmdbar-event-card-conflict">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Conflicts with: {conflicts.map(c => c.title).join(', ')}</span>
                      </div>
                    )}
                    {isLatestCard && pendingEvent && (
                      <div className="cmdbar-event-card-actions">
                        <button className="cmdbar-event-card-btn cmdbar-event-card-btn--create" onClick={handleCreate}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Create Event
                        </button>
                        <button className="cmdbar-event-card-btn cmdbar-event-card-btn--cancel" onClick={handleCancel}>Cancel</button>
                      </div>
                    )}
                    {isLatestCard && pendingEvent && (
                      <div className="cmdbar-event-card-hint">Type to modify — "add Priya", "make it 2pm", "change to 90 min"</div>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}

          {loading && (
            <div className="cmdbar-msg cmdbar-msg--loading">
              <div className="cmdbar-loading-dots"><span /><span /><span /></div>
            </div>
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="cmdbar-input-area">
        {/* Mode Toggle */}
        <div className="cmdbar-toggle">
          <button
            className={`cmdbar-toggle-btn ${mode === 'search' ? 'cmdbar-toggle-btn--active' : ''}`}
            onClick={() => switchMode('search')}
            title="Search"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button
            className={`cmdbar-toggle-btn ${mode === 'ai' ? 'cmdbar-toggle-btn--active' : ''}`}
            onClick={() => switchMode('ai')}
            title="AI Schedule"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
            </svg>
          </button>
        </div>

        <div className="cmdbar-input-field">
          <input
            ref={inputRef}
            type="text"
            className="cmdbar-input"
            placeholder={mode === 'search'
              ? 'Search events, people, tags...'
              : (pendingEvent ? 'Modify event — "add Priya", "move to 2pm"...' : 'Type to schedule — "meeting with Tanuj tomorrow 3pm"')
            }
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            disabled={loading}
          />
          {query && (
            <button className="cmdbar-clear" onClick={() => {
              setQuery('')
              if (mode === 'search') { onSearchResults(null); onSearchQueryChange('') }
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {mode === 'ai' && (
          <button
            className="cmdbar-send"
            onClick={handleAISend}
            disabled={!query.trim() || loading}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
