import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { calendarTasks, eventColors, notes as allNotes, activityLogs, featureDocItems, agentSessions } from '../data/sampleData'
import CommandBar from './CommandBar'
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

function minutesToTimeStr(totalMin) {
  const h = Math.max(0, Math.min(23, Math.floor(totalMin / 60)))
  const m = Math.max(0, Math.min(59, totalMin % 60))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

// Get all events across all dates for search. Merges static calendarTasks
// with any user-created events passed in.
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

// ── Natural-language Scheduling ─────────────────────────────────────────
// Parses phrases like "schedule a meeting with tanuj on 10 april 3 pm" into
// a structured event spec. Requires a resolvable date AND time to match — if
// either is missing we return null and let the search fall through.

const MONTH_MAP = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function capitalizeWord(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

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
  // "10 april", "10th apr", "april 10", "apr 10th"
  const dayFirst = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/)
  const monthFirst = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/)
  let day = null, monthName = null
  if (dayFirst) { day = parseInt(dayFirst[1], 10); monthName = dayFirst[2] }
  else if (monthFirst) { day = parseInt(monthFirst[2], 10); monthName = monthFirst[1] }
  if (day != null && monthName != null) {
    const monthIdx = MONTH_MAP[monthName]
    if (monthIdx != null && day >= 1 && day <= 31) {
      // Anchor to the year of todayStr — year rollover intentionally ignored
      // for simplicity; users can type the year explicitly in a future pass.
      return formatDateStr(new Date(today.getFullYear(), monthIdx, day))
    }
  }
  return null
}

function parseTimeFromText(q) {
  // 12-hour: "3 pm", "3pm", "3:30pm", "at 11:15 am"
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
  // 24-hour: "15:00", "at 9:30" — require colon to avoid swallowing day numbers
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
  // Intent gate: must start with an action verb OR mention both "schedule"
  // (or similar) and a recognized event type somewhere.
  const hasIntent = /^(schedule|add|create|book|set\s*up|new)\b/.test(q) ||
    (/(schedule|book|add|create)/.test(q) && EVENT_TYPE_RE.test(q))
  if (!hasIntent) return null

  const typeMatch = q.match(EVENT_TYPE_RE)
  const type = typeMatch ? typeMatch[1].replace(/[- ]/g, ' ') : 'meeting'

  // Attendees: capture everything after "with " until we hit a boundary word
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

function addMinutesToTimeStr(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.min(23, Math.floor(total / 60))
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
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

function runTimeQuery(parsed, currentDateStr, userEvents = {}) {
  if (parsed.kind === 'productivity') {
    const all = getAllEvents(userEvents)
    const scored = all
      .map(ev => ({ ev, ...scoreEventProductivity(ev) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
    return { kind: 'productivity', top: scored.slice(0, 5) }
  }
  if (parsed.kind === 'timeOn') {
    const needle = parsed.project.toLowerCase()
    const all = getAllEvents(userEvents)
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
    const all = getAllEvents(userEvents)
    const meetings = all
      .filter(ev => ev.attendees && ev.attendees.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    return { kind: 'meetings', events: meetings }
  }
  if (parsed.kind === 'freeTime') {
    const dayEvents = [
      ...(calendarTasks[currentDateStr] || []),
      ...((userEvents && userEvents[currentDateStr]) || []),
    ].sort(
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

// Compute side-by-side column layout for overlapping events.
// Returns { [eventId]: { col, totalCols } }.
function computeOverlapLayout(events) {
  if (!events.length) return {}
  const sorted = [...events]
    .map(e => ({ ...e, _startMin: timeToMinutes(e.time), _endMin: timeToMinutes(e.endTime) }))
    .sort((a, b) => a._startMin - b._startMin || (b._endMin - b._startMin) - (a._endMin - a._startMin))

  const layout = {}
  const colEnds = [] // latest end-time in each column
  for (const ev of sorted) {
    let col = -1
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= ev._startMin) { col = c; break }
    }
    if (col === -1) { col = colEnds.length; colEnds.push(0) }
    colEnds[col] = ev._endMin
    layout[ev.id] = { col, totalCols: 1 }
  }
  // Find connected overlap groups and set totalCols per group
  const visited = new Set()
  for (const ev of sorted) {
    if (visited.has(ev.id)) continue
    const group = []
    const stack = [ev]
    while (stack.length) {
      const curr = stack.pop()
      if (visited.has(curr.id)) continue
      visited.add(curr.id)
      group.push(curr)
      for (const other of sorted) {
        if (!visited.has(other.id) && other._startMin < curr._endMin && other._endMin > curr._startMin) {
          stack.push(other)
        }
      }
    }
    const maxCol = Math.max(...group.map(e => layout[e.id].col))
    const totalCols = maxCol + 1
    for (const e of group) layout[e.id].totalCols = totalCols
  }
  return layout
}

export default function CalendarPanel({ selectedDate, setSelectedDate, selectedEvent, setSelectedEvent, onSlotClick, onQuickNoteAdd, onThoughtDelete, onThoughtUpdate, onQuickSlotClear, quickSlot, thoughts = {}, onDatePanelOpen, userEvents = {}, onScheduleEvent, onEventUpdate, eventOverrides = {}, googleConnected = false, googleSyncing = false, googleError = null, onGoogleConnect, onGoogleRefresh }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    return new Date()
  })
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(56) // pixels per hour; continuous 24..240
  // Semantic zoom: 0 = normal grid (pixel zoom), 1 = schedule list, 2 = detail view
  const [viewMode, setViewMode] = useState(0)
  const [detailIndex, setDetailIndex] = useState(0) // which event is shown in detail view (mode 2)
  const [searchDetailEvent, setSearchDetailEvent] = useState(null)
  const [savedSearchResults, setSavedSearchResults] = useState(null)
  const [activityExpanded, setActivityExpanded] = useState(true)
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  const truncateWords = (text, limit = 50) => {
    if (!text) return { truncated: '', isTruncated: false }
    const words = text.split(/\s+/)
    if (words.length <= limit) return { truncated: text, isTruncated: false }
    return { truncated: words.slice(0, limit).join(' ') + '...', isTruncated: true }
  }
  const [expandedEvent, setExpandedEvent] = useState(null) // event id for overlay
  const [overlayOrigin, setOverlayOrigin] = useState(null) // { top, left, width, height } for unfold origin
  const [isClosingOverlay, setIsClosingOverlay] = useState(false)
  const [pullProgress, setPullProgress] = useState(0) // -1..1 (negative = prev day pull, positive = next day pull)
  const [dayTransition, setDayTransition] = useState(null) // 'prev' | 'next' during day flip
  const [hoveredEventId, setHoveredEventId] = useState(null) // event id for the hover peek card
  // Search state — lifted from CommandBar so results render in the calendar area
  const [searchResults, setSearchResults] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  // Draft text for the inline quick-note input that pops up when an empty slot is clicked
  const [quickNoteText, setQuickNoteText] = useState('')
  const quickNoteInputRef = useRef(null)
  const [editingNote, setEditingNote] = useState(null) // { id, text }
  const gridRef = useRef(null)
  const panelRef = useRef(null)
  const scheduleViewRef = useRef(null)
  const pullAccum = useRef(0)
  const pullTimer = useRef(null)
  const closeTimeoutRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const zoomAnimRef = useRef(null) // rAF handle for button-triggered zoom animations

  // ── Drag-to-reschedule & Resize state ──
  const [dragInfo, setDragInfo] = useState(null)   // { eventId, newTime, newEndTime }
  const [resizeInfo, setResizeInfo] = useState(null) // { eventId, newEndTime }
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const wasDraggingRef = useRef(false)
  const zoomRef = useRef(56)
  zoomRef.current = zoomLevel

  // ── Zoom Continuity ──
  // Continuous range — 24 px/hr (whole day compressed) to 240 px/hr (fine-grained).
  const MIN_ZOOM = 24
  const MAX_ZOOM = 240
  // Sub-hour tick opacities interpolate with zoom so granularity fades in/out
  // instead of snapping. At 48 px/hr the 30-min ticks begin appearing; at 72
  // they are fully visible. At 96 the 15-min ticks start; at 120 they are full.
  const halfOpacity = Math.max(0, Math.min(1, (zoomLevel - 48) / 24))
  const quarterOpacity = Math.max(0, Math.min(1, (zoomLevel - 96) / 24))
  // At very low zoom the hour labels overlap — thin them to every other hour.
  const labelStride = zoomLevel < 32 ? 2 : 1

  const dateStr = formatDateStr(currentDate)
  const now = new Date()
  const TODAY_STR = formatDateStr(now)
  const NOW_MIN = now.getHours() * 60 + now.getMinutes()
  const isToday = dateStr === TODAY_STR
  const dayRelation = dateStr < TODAY_STR ? 'past' : dateStr > TODAY_STR ? 'future' : 'today'
  const nowPx = (NOW_MIN / 60) * zoomLevel
  const headerLabel = `${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  // Merge static events with any user-scheduled ones for this date,
  // then apply any drag/resize overrides so moved events render correctly.
  const tasks = useMemo(() => {
    const raw = [...(calendarTasks[dateStr] || []), ...((userEvents && userEvents[dateStr]) || [])]
    return raw.map(ev => {
      const ov = eventOverrides[ev.id]
      if (ov) return { ...ev, time: ov.time, endTime: ov.endTime }
      return ev
    })
  }, [dateStr, userEvents, eventOverrides])

  // Schedule view data — all events across all dates, grouped by date, sorted chronologically.
  // Used for viewMode 2 (schedule list) and viewMode 3 (detail view).
  const scheduleData = useMemo(() => {
    const allDates = new Set([...Object.keys(calendarTasks), ...Object.keys(userEvents || {})])
    const sorted = [...allDates].sort()
    const groups = []
    const flatEvents = []
    for (const d of sorted) {
      const raw = [...(calendarTasks[d] || []), ...((userEvents && userEvents[d]) || [])]
      const events = raw.map(ev => {
        const ov = eventOverrides[ev.id]
        return ov ? { ...ev, time: ov.time, endTime: ov.endTime, _date: d } : { ...ev, _date: d }
      }).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
      if (events.length > 0) {
        groups.push({ date: d, events })
        events.forEach(ev => flatEvents.push(ev))
      }
    }
    return { groups, flatEvents }
  }, [userEvents, eventOverrides])

  // Overlap layout — assigns columns to events sharing time
  const overlapLayout = useMemo(() => computeOverlapLayout(tasks), [tasks])

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

  const goToPrev = () => {
    setDayTransition('prev')
    setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d })
    setTimeout(() => setDayTransition(null), 300)
  }
  const goToNext = () => {
    setDayTransition('next')
    setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d })
    setTimeout(() => setDayTransition(null), 300)
  }
  const goToToday = () => {
    setDayTransition('next')
    setCurrentDate(new Date())
    setTimeout(() => setDayTransition(null), 300)
  }

  // Animated zoom — used by +/− buttons. Tweens zoomLevel AND scrollTop over
  // ~260ms so the time point at the viewport center stays visually anchored.
  // Without this, zooming in makes the viewport "scroll" as events grow taller.
  const animateZoomTo = useCallback((targetZoom) => {
    if (zoomAnimRef.current) cancelAnimationFrame(zoomAnimRef.current)
    const scroller = gridRef.current
    if (!scroller) { setZoomLevel(targetZoom); return }
    const startZoom = zoomLevel
    if (startZoom === targetZoom) return
    const viewportH = scroller.clientHeight
    const anchorPx = scroller.scrollTop + viewportH / 2
    const anchorMin = (anchorPx / startZoom) * 60
    const startTime = performance.now()
    const duration = 260
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const z = startZoom + (targetZoom - startZoom) * eased
      setZoomLevel(z)
      const newAnchorPx = (anchorMin / 60) * z
      scroller.scrollTop = newAnchorPx - viewportH / 2
      if (t < 1) {
        zoomAnimRef.current = requestAnimationFrame(step)
      } else {
        zoomAnimRef.current = null
      }
    }
    zoomAnimRef.current = requestAnimationFrame(step)
  }, [zoomLevel])

  const zoomInPixel = () => animateZoomTo(Math.min(zoomLevel + 24, MAX_ZOOM))
  const zoomOutPixel = () => animateZoomTo(Math.max(zoomLevel - 24, MIN_ZOOM))

  // Semantic zoom: grid → schedule list → detail view, one click per step.
  // Pixel-level zoom of the grid is still available via Cmd/Ctrl + wheel.
  const zoomIn = () => {
    if (viewMode === 0) {
      setViewMode(1)
    } else if (viewMode === 1) {
      setViewMode(2)
      // Jump to the event nearest the currently viewed date, not the first
      // event in the whole dataset — otherwise this always lands on the
      // earliest mock date regardless of what day is actually selected.
      const flat = scheduleData.flatEvents
      let idx = flat.findIndex(ev => ev._date >= dateStr)
      if (idx === -1) idx = Math.max(0, flat.length - 1)
      setDetailIndex(idx)
    }
  }
  const zoomOut = () => {
    if (viewMode === 2) {
      setViewMode(1)
    } else if (viewMode === 1) {
      setViewMode(0)
    }
  }

  // Entering the Schedule list should open scrolled to the current date's
  // group (or the nearest one after it if today has no events) — not the
  // top of the list, which is always the earliest mock date.
  useEffect(() => {
    if (viewMode !== 1) return
    const container = scheduleViewRef.current
    if (!container) return
    const groups = scheduleData.groups
    let idx = groups.findIndex(g => g.date >= dateStr)
    if (idx === -1) idx = groups.length - 1
    const target = container.children[idx]
    target?.scrollIntoView({ block: 'start' })
  }, [viewMode, dateStr, scheduleData.groups])

  // Cmd/Ctrl + wheel: continuous zoom anchored on the cursor position.
  // The point in time under the cursor stays under the cursor as zoom changes.
  const handleZoomWheel = useCallback((e) => {
    if (zoomAnimRef.current) cancelAnimationFrame(zoomAnimRef.current)
    const scroller = gridRef.current
    if (!scroller) return
    // Normalize delta — some devices report big jumps, clamp for sanity
    const delta = Math.max(-80, Math.min(80, -e.deltaY)) * 0.35
    const rect = scroller.getBoundingClientRect()
    const cursorY = e.clientY - rect.top + scroller.scrollTop
    setZoomLevel(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
      if (next === prev) return prev
      // Re-anchor scroll so cursor stays over the same minute
      const anchorMin = (cursorY / prev) * 60
      requestAnimationFrame(() => {
        const newCursorPx = (anchorMin / 60) * next
        scroller.scrollTop = newCursorPx - (e.clientY - rect.top)
      })
      return next
    })
  }, [])

  // Keyboard navigation for detail view (viewMode 2)
  useEffect(() => {
    if (viewMode !== 2) return
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setDetailIndex(prev => Math.max(0, prev - 1)); setSummaryExpanded(false)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setDetailIndex(prev => Math.min(scheduleData.flatEvents.length - 1, prev + 1)); setSummaryExpanded(false)
      } else if (e.key === 'Escape') {
        setViewMode(1) // go back to schedule list
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, scheduleData.flatEvents.length])

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

  // Scroll to a sensible position on day change. On today, center the
  // now-line in the viewport; on other days, scroll to ~7 AM (start of
  // working hours).
  useEffect(() => {
    const scroller = gridRef.current
    if (!scroller) return
    const newDateStr = formatDateStr(currentDate)
    if (newDateStr === TODAY_STR) {
      const nowPxPos = (NOW_MIN / 60) * zoomLevel
      const viewportH = scroller.clientHeight
      scroller.scrollTop = Math.max(0, nowPxPos - viewportH / 2)
    } else {
      scroller.scrollTop = zoomLevel * 7
    }
  }, [currentDate]) // only on day change — zoom changes manage their own scroll anchor

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
    // Future events have no summary/activity yet — suppress the hover peek
    if (getTemporalState(event) === 'future') return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredEventId(event.id)
    }, 380)
  }, [expandedEvent, dayRelation])

  const handleEventLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current)
    setHoveredEventId(null)
  }, [])

  // ── Drag-to-reschedule ──
  const handleDragStart = useCallback((e, task) => {
    e.preventDefault()
    const startMin = timeToMinutes(task.time)
    const endMin = timeToMinutes(task.endTime)
    const duration = endMin - startMin
    const gridRect = gridRef.current?.getBoundingClientRect()
    if (!gridRect) return
    const scrollTop = gridRef.current.scrollTop
    const clickY = e.clientY - gridRect.top + scrollTop
    const clickMin = (clickY / zoomRef.current) * 60
    const offsetMin = clickMin - startMin
    const startX = e.clientX
    const startY = e.clientY
    let isDragging = false

    dragRef.current = { eventId: task.id, origStartMin: startMin, duration, offsetMin, lastSnapMin: startMin }

    const onMove = (me) => {
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      if (!isDragging && Math.abs(dx) + Math.abs(dy) < 5) return
      if (!isDragging) {
        isDragging = true
        setHoveredEventId(null)
        clearTimeout(hoverTimerRef.current)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }
      const dr = dragRef.current
      if (!dr) return
      const gr = gridRef.current?.getBoundingClientRect()
      if (!gr) return
      const mouseY = me.clientY - gr.top + gridRef.current.scrollTop
      const mouseMin = (mouseY / zoomRef.current) * 60
      const newStartMin = mouseMin - dr.offsetMin
      const snappedMin = Math.round(newStartMin / 15) * 15
      const clampedMin = Math.max(0, Math.min(24 * 60 - dr.duration, snappedMin))
      if (clampedMin !== dr.lastSnapMin) {
        dr.lastSnapMin = clampedMin
        setDragInfo({
          eventId: dr.eventId,
          newTime: minutesToTimeStr(clampedMin),
          newEndTime: minutesToTimeStr(clampedMin + dr.duration),
        })
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (isDragging) {
        const dr = dragRef.current
        if (dr && dr.lastSnapMin !== dr.origStartMin && onEventUpdate) {
          onEventUpdate(dr.eventId, dateStr, minutesToTimeStr(dr.lastSnapMin), minutesToTimeStr(dr.lastSnapMin + dr.duration))
        }
        wasDraggingRef.current = true
      }
      dragRef.current = null
      setDragInfo(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [dateStr, onEventUpdate])

  // ── Resize (bottom edge) ──
  const handleResizeStart = useCallback((e, task) => {
    e.preventDefault()
    e.stopPropagation()
    const origEndMin = timeToMinutes(task.endTime)
    const startMin = timeToMinutes(task.time)
    const startY = e.clientY
    let isResizing = false

    resizeRef.current = { eventId: task.id, startMin, origEndMin, lastSnapEndMin: origEndMin }

    const onMove = (me) => {
      const dy = me.clientY - startY
      if (!isResizing && Math.abs(dy) < 3) return
      if (!isResizing) {
        isResizing = true
        setHoveredEventId(null)
        clearTimeout(hoverTimerRef.current)
        document.body.style.cursor = 'ns-resize'
        document.body.style.userSelect = 'none'
      }
      const rr = resizeRef.current
      if (!rr) return
      const deltaMin = (dy / zoomRef.current) * 60
      const newEndMin = rr.origEndMin + deltaMin
      const snappedEndMin = Math.round(newEndMin / 15) * 15
      const clampedEndMin = Math.max(rr.startMin + 15, Math.min(24 * 60, snappedEndMin))
      if (clampedEndMin !== rr.lastSnapEndMin) {
        rr.lastSnapEndMin = clampedEndMin
        setResizeInfo({ eventId: rr.eventId, newEndTime: minutesToTimeStr(clampedEndMin) })
      }
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (isResizing) {
        const rr = resizeRef.current
        if (rr && rr.lastSnapEndMin !== rr.origEndMin && onEventUpdate) {
          const t = tasks.find(t => t.id === rr.eventId)
          if (t) onEventUpdate(rr.eventId, dateStr, t.time, minutesToTimeStr(rr.lastSnapEndMin))
        }
        wasDraggingRef.current = true
      }
      resizeRef.current = null
      setResizeInfo(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [dateStr, tasks, onEventUpdate])

  // Resolve hovered task for peek render
  const hoveredTask = hoveredEventId && !expandedEvent
    ? tasks.find(t => t.id === hoveredEventId)
    : null

  const handleEventClick = (e, event) => {
    e.stopPropagation()
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return }
    // Future events have no summary/activity to show yet — clicking is inert
    if (getTemporalState(event) === 'future') return
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
    // Cmd/Ctrl + wheel: zoom the time axis (pre-empts day-flipping)
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      handleZoomWheel(e)
      return
    }
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
  }, [expandedEvent, handleZoomWheel])

  const handleSlotClick = (e) => {
    if (!onSlotClick) return
    // getBoundingClientRect() is viewport-relative, which already accounts for
    // scroll — don't add scrollTop again or the computed time drifts forward
    // by however many hours the grid is scrolled.
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
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

  // Jump to a specific date from command bar
  const handleJumpToDate = (date, ev) => {
    const nd = new Date(date + 'T00:00:00')
    setCurrentDate(nd)
    if (ev) setSelectedEvent(ev)
  }

  // Search results callbacks — CommandBar pushes results up; CalendarPanel renders them
  const handleSearchResults = useCallback((results) => {
    setSearchResults(results)
  }, [])
  const handleSearchQueryChange = useCallback((q) => {
    setSearchQuery(q)
  }, [])

  // Jump helpers for search result cards
  const jumpToEvent = (date, ev) => {
    setCurrentDate(new Date(date + 'T00:00:00'))
    setSelectedEvent(ev)
    setSearchResults(null)
    setSearchQuery('')
  }
  const jumpToDate = (date) => {
    setCurrentDate(new Date(date + 'T00:00:00'))
    setSearchResults(null)
    setSearchQuery('')
  }
  const openSearchDetail = (date, ev) => {
    setSavedSearchResults(searchResults)
    setSearchDetailEvent({ ...ev, _date: date })
    setSearchResults(null)
  }
  const backToSearchResults = () => {
    setSearchDetailEvent(null)
    setSearchResults(savedSearchResults)
    setSavedSearchResults(null)
  }

  // Derive search results kind for inline rendering
  const searchKind = searchResults ? (searchResults.kind || 'search') : null

  return (
    <div className="calendar-panel" ref={panelRef}>
      {/* Header */}
      {searchResults ? null : (
      <div className="cal-header">
        <div className="cal-header-left">
          {viewMode === 0 ? (
            <>
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
            </>
          ) : (
            <div className="cal-view-mode-label">
              <span className="cal-view-mode-icon">
                {viewMode === 1 ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                )}
              </span>
              <span className="cal-view-mode-text">
                {viewMode === 1 ? 'Schedule' : 'Detail'}
              </span>
            </div>
          )}
        </div>
        <div className="cal-header-right">
          <button
            className={`cal-gcal-btn ${googleConnected ? 'connected' : ''} ${googleError ? 'error' : ''}`}
            onClick={onGoogleConnect}
            disabled={googleSyncing}
            title={googleError ? googleError : googleConnected ? 'Google Calendar connected — click to disconnect' : 'Connect Google Calendar'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={googleSyncing ? 'spin' : ''}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          {googleConnected && (
            <button
              className="cal-gcal-refresh-btn"
              onClick={onGoogleRefresh}
              disabled={googleSyncing}
              title="Refresh from Google Calendar now"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={googleSyncing ? 'spin' : ''}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          )}
          <div className="cal-zoom-btns">
            <button className="cal-zoom-btn" onClick={zoomOut} disabled={viewMode === 0} title="Zoom out — less detail">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button className="cal-zoom-btn" onClick={zoomIn} disabled={viewMode >= 2} title="Zoom in — more detail">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Search results — shown in place of the grid when active */}
      {searchResults && (() => {
        const kind = searchKind
        return (
          <div className="cal-search-results">
            {/* Scheduled success card */}
            {kind === 'scheduled' && (() => {
              const ev = searchResults.event
              const d = new Date(searchResults.date + 'T00:00:00')
              const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
              return (
                <div className="cal-schedule-success">
                  <div className="cal-schedule-success-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="cal-schedule-success-label">Meeting scheduled</div>
                  <div className="cal-schedule-success-title">{ev.title}</div>
                  <div className="cal-schedule-success-meta">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>{dateLabel}</span>
                    <span className="cal-schedule-success-dot">·</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                  </div>
                  {ev.attendees && ev.attendees.length > 0 && (
                    <div className="cal-schedule-success-attendees">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>{ev.attendees.join(', ')}</span>
                    </div>
                  )}
                  <div className="cal-schedule-success-actions">
                    <button className="cal-schedule-success-btn primary" onClick={() => { jumpToEvent(searchResults.date, ev) }}>
                      <span>Jump to date</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                    <button className="cal-schedule-success-btn" onClick={() => { setSearchResults(null); setSearchQuery('') }}>Done</button>
                  </div>
                </div>
              )
            })()}

            {/* Productivity answer card */}
            {kind === 'productivity' && (() => {
              const top = searchResults.top
              if (!top || top.length === 0) return <div className="cal-search-empty"><p>Not enough data to rank productivity yet.</p></div>
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
                    <div className="cal-query-answer-time">{formatTimeDisplay(winner.ev.time)} – {formatTimeDisplay(winner.ev.endTime)}</div>
                    <div className="cal-query-answer-title">{winner.ev.title}</div>
                    <div className="cal-query-answer-date">{winnerDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div className="cal-query-metrics">
                    {winner.logCount > 0 && <div className="cal-query-metric"><span className="cal-query-metric-val">{winner.logCount}</span><span className="cal-query-metric-label">activity logs</span></div>}
                    {winner.sessionCount > 0 && <div className="cal-query-metric"><span className="cal-query-metric-val">{winner.sessionCount}</span><span className="cal-query-metric-label">agent {winner.sessionCount === 1 ? 'session' : 'sessions'}</span></div>}
                    {winner.doneCount > 0 && <div className="cal-query-metric"><span className="cal-query-metric-val">{winner.doneCount}/{winner.totalAction}</span><span className="cal-query-metric-label">tasks done</span></div>}
                    <div className="cal-query-metric"><span className="cal-query-metric-val">{formatDuration(winner.duration)}</span><span className="cal-query-metric-label">focus time</span></div>
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
                                <span className="cal-query-runner-meta">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTimeDisplay(r.ev.time)}</span>
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
              if (!events || events.length === 0) return <div className="cal-search-empty"><p>No time logged on <strong>{project}</strong>.</p></div>
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

            {/* Meetings answer card — schedule-view style */}
            {kind === 'meetings' && (() => {
              const events = searchResults.events
              if (!events || events.length === 0) return <div className="cal-search-empty"><p>No meetings found.</p></div>
              // Group by date
              const byDate = {}
              events.forEach(ev => {
                if (!byDate[ev.date]) byDate[ev.date] = []
                byDate[ev.date].push(ev)
              })
              const dates = Object.keys(byDate).sort()
              return (
                <div className="cal-schedule-view">
                  {dates.map(date => {
                    const d = new Date(date + 'T00:00:00')
                    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                    return (
                      <div key={date} className="cal-schedule-day">
                        <div className="cal-schedule-day-header">
                          <span className="cal-schedule-day-label">{dayLabel}</span>
                        </div>
                        <div className="cal-schedule-day-events">
                          {byDate[date].map(ev => {
                            const color = eventColors[ev.colorIndex] || eventColors[0]
                            return (
                              <div key={ev.id} className="cal-schedule-event" onClick={() => openSearchDetail(ev.date, ev)}>
                                <div className="cal-schedule-event-color" style={{ background: color.border }} />
                                <div className="cal-schedule-event-body">
                                  <div className="cal-schedule-event-row">
                                    <span className="cal-schedule-event-title">{ev.title}</span>
                                    <span className="cal-schedule-event-time">{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                                  </div>
                                  {ev.aiSummary && (
                                    <div className="cal-schedule-event-summary">{ev.aiSummary}</div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Free-time answer card */}
            {kind === 'freeTime' && (() => {
              const { gaps, totalFreeMin, dateStr: dStr } = searchResults
              const d = new Date(dStr + 'T00:00:00')
              if (!gaps || gaps.length === 0) return <div className="cal-search-empty"><p>No free blocks of 45+ min on {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.</p></div>
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

            {/* Default text-search results — schedule-view style */}
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
              return (
                <div className="cal-schedule-view">
                  {dates.map(date => {
                    const d = new Date(date + 'T00:00:00')
                    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                    return (
                      <div key={date} className="cal-schedule-day">
                        <div className="cal-schedule-day-header">
                          <span className="cal-schedule-day-label">{dayLabel}</span>
                        </div>
                        <div className="cal-schedule-day-events">
                          {grouped[date].map(ev => {
                            const color = eventColors[ev.colorIndex] || eventColors[0]
                            return (
                              <div key={ev.id} className="cal-schedule-event" onClick={() => openSearchDetail(date, ev)}>
                                <div className="cal-schedule-event-color" style={{ background: color.border }} />
                                <div className="cal-schedule-event-body">
                                  <div className="cal-schedule-event-row">
                                    <span className="cal-schedule-event-title">{ev.title}</span>
                                    <span className="cal-schedule-event-time">{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                                  </div>
                                  {ev.aiSummary && (
                                    <div className="cal-schedule-event-summary">{ev.aiSummary}</div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* Search Detail View */}
      {searchDetailEvent && (() => {
        const ev = searchDetailEvent
        const color = eventColors[ev.colorIndex] || eventColors[0]
        const summary = getEventSummaryData(ev, ev._date)
        return (
          <div className="cal-detail-view">
            <div className="cal-overlay-card cal-detail-card-inline" style={{ borderLeftColor: color.border }}>
              <div className="cal-overlay-header">
                <div className="cal-overlay-header-text">
                  <div className="cal-overlay-title">{ev.title}</div>
                  <div className="cal-overlay-sub">
                    <span>{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                    {ev.project && <span className="cal-overlay-dot">·</span>}
                    {ev.project && <span className="cal-overlay-project">#{ev.project}</span>}
                  </div>
                </div>
                <div className="cal-detail-nav-inline">
                  <button className="cal-detail-close-btn" onClick={backToSearchResults} title="Back to results">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              <div className="cal-detail-stacked">
                {/* Summary */}
                {ev.aiSummary && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta-row cal-detail-summary-row">
                      <span className="cal-detail-meta-label">Summary</span>
                      <span className="cal-detail-meta-value">
                        {(() => {
                          const { truncated, isTruncated } = truncateWords(ev.aiSummary)
                          return <>
                            {summaryExpanded ? ev.aiSummary : truncated}
                            {isTruncated && (
                              <button className="cal-detail-read-more" onClick={() => setSummaryExpanded(prev => !prev)}>
                                {summaryExpanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </>
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Planned / Done / Docs / Agent */}
                {(summary.approachSummary || summary.features.length > 0 || summary.agentSummary) && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta">
                      {summary.approachSummary && (
                        <>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Planned</span>
                            <span className="cal-detail-meta-value">{summary.approachSummary.plannedText}</span>
                          </div>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Done</span>
                            <span className="cal-detail-meta-value">{summary.approachSummary.doneText}</span>
                          </div>
                        </>
                      )}
                      {summary.features.length > 0 && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Docs</span>
                          <span className="cal-detail-meta-value">{summary.features.map(f => f.title).join(', ')}</span>
                        </div>
                      )}
                      {summary.agentSummary && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Agent</span>
                          <span className="cal-detail-meta-value cal-detail-meta-value--italic">{summary.agentSummary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Activity & Logs */}
                <div className="cal-detail-section">
                  <button className="cal-detail-activity-toggle" onClick={() => setActivityExpanded(prev => !prev)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: activityExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className="cal-overlay-col-title" style={{ margin: 0 }}>Activity & Logs</span>
                    {summary.logs.length > 0 && <span className="cal-detail-activity-count">{summary.logs.length}</span>}
                  </button>
                  {activityExpanded && (
                    <div className="cal-detail-activity-body">
                      {summary.logs.length === 0 ? (
                        <div className="cal-overlay-empty">No activity logged during this event</div>
                      ) : (
                        <div className="cal-overlay-logs">
                          {summary.logs.map(log => (
                            <div key={log.id} className={`cal-overlay-log cal-overlay-log--${log.type}`}>
                              <span className="cal-overlay-log-time">{formatTimeDisplay(log.time)}</span>
                              <span className={`cal-overlay-log-dot cal-overlay-log-dot--${log.type}`} />
                              <span className="cal-overlay-log-action">{log.action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mini Calendar Dropdown */}
      {!searchResults && !searchDetailEvent && showMiniCal && (
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
              const hasEvents = cellDate && ((calendarTasks[cellDate]?.length > 0) || (userEvents?.[cellDate]?.length > 0))
              const isSelected = cellDate === dateStr
              const isTodayCell = cellDate === TODAY_STR
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

      {/* Calendar content — hidden when search results are active */}
      {!searchResults && !searchDetailEvent && (<>

      {/* ── VIEW MODE 1: Schedule List ── */}
      {viewMode === 1 && (
        <div className="cal-schedule-view" ref={scheduleViewRef}>
          {scheduleData.groups.map(group => {
            const d = new Date(group.date + 'T00:00:00')
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
            const isCurrentDay = group.date === dateStr
            return (
              <div key={group.date} className={`cal-schedule-day ${isCurrentDay ? 'cal-schedule-day--current' : ''}`}>
                <div className="cal-schedule-day-header">
                  <span className="cal-schedule-day-label">{dayLabel}</span>
                </div>
                <div className="cal-schedule-day-events">
                  {group.events.map(ev => {
                    const color = eventColors[ev.colorIndex] || eventColors[0]
                    return (
                      <button
                        key={ev.id}
                        className={`cal-schedule-event ${selectedEvent?.id === ev.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedEvent(ev)
                          // Jump to detail view for this event
                          const idx = scheduleData.flatEvents.findIndex(e => e.id === ev.id)
                          if (idx >= 0) {
                            setDetailIndex(idx)
                            setViewMode(2)
                          }
                        }}
                      >
                        <div className="cal-schedule-event-color" style={{ background: color.border }} />
                        <div className="cal-schedule-event-info">
                          <div className="cal-schedule-event-row">
                            <span className="cal-schedule-event-title">{ev.title}</span>
                            <span className="cal-schedule-event-time">{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                          </div>
                          {(ev.aiSummary || ev.summary) && (
                            <span className="cal-schedule-event-summary">{ev.aiSummary || ev.summary}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── VIEW MODE 2: Detail View with left/right navigation ── */}
      {viewMode === 2 && (() => {
        const ev = scheduleData.flatEvents[detailIndex]
        if (!ev) return null
        const color = eventColors[ev.colorIndex] || eventColors[0]
        const summary = getEventSummaryData(ev, ev._date)
        const hasPrev = detailIndex > 0
        const hasNext = detailIndex < scheduleData.flatEvents.length - 1
        return (
          <div className="cal-detail-view">
            {/* Reuses the same overlay card layout as the click-to-expand overlay */}
            <div className="cal-overlay-card cal-detail-card-inline" style={{ borderLeftColor: color.border }}>
              <div className="cal-overlay-header">
                <div className="cal-overlay-header-text">
                  <div className="cal-overlay-title">{ev.title}</div>
                  <div className="cal-overlay-sub">
                    <span>{formatTimeDisplay(ev.time)} – {formatTimeDisplay(ev.endTime)}</span>
                    {ev.project && <span className="cal-overlay-dot">·</span>}
                    {ev.project && <span className="cal-overlay-project">#{ev.project}</span>}
                  </div>
                </div>
                <div className="cal-detail-nav-inline">
                  <button className="cal-detail-nav-arrow" onClick={() => setDetailIndex(Math.max(0, detailIndex - 1))} disabled={!hasPrev}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button className="cal-detail-nav-arrow" onClick={() => setDetailIndex(Math.min(scheduleData.flatEvents.length - 1, detailIndex + 1))} disabled={!hasNext}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <button className="cal-detail-close-btn" onClick={() => setViewMode(1)} title="Back to Schedule">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <div className="cal-detail-stacked">
                {/* Summary */}
                {ev.aiSummary && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta-row cal-detail-summary-row">
                      <span className="cal-detail-meta-label">Summary</span>
                      <span className="cal-detail-meta-value">
                        {(() => {
                          const { truncated, isTruncated } = truncateWords(ev.aiSummary)
                          return <>
                            {summaryExpanded ? ev.aiSummary : truncated}
                            {isTruncated && (
                              <button className="cal-detail-read-more" onClick={() => setSummaryExpanded(prev => !prev)}>
                                {summaryExpanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </>
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Planned / Done / Docs / Agent */}
                {(summary.approachSummary || summary.features.length > 0 || summary.agentSummary) && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta">
                      {summary.approachSummary && (
                        <>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Planned</span>
                            <span className="cal-detail-meta-value">{summary.approachSummary.plannedText}</span>
                          </div>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Done</span>
                            <span className="cal-detail-meta-value">{summary.approachSummary.doneText}</span>
                          </div>
                        </>
                      )}
                      {summary.features.length > 0 && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Docs</span>
                          <span className="cal-detail-meta-value">{summary.features.map(f => f.title).join(', ')}</span>
                        </div>
                      )}
                      {summary.agentSummary && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Agent</span>
                          <span className="cal-detail-meta-value cal-detail-meta-value--italic">{summary.agentSummary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabs / Sites */}
                {ev.workActivity && (ev.workActivity.tabs?.length > 0 || ev.workActivity.sites?.length > 0) && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-work">
                      {ev.workActivity.tabs && ev.workActivity.tabs.length > 0 && (
                        <div className="cal-detail-work-section">
                          <div className="cal-detail-work-heading">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                            <span>Tabs opened</span>
                          </div>
                          <div className="cal-detail-tags-list">
                            {ev.workActivity.tabs.map((t, i) => (
                              <span key={i} className="cal-detail-tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {ev.workActivity.sites && ev.workActivity.sites.length > 0 && (
                        <div className="cal-detail-work-section">
                          <div className="cal-detail-work-heading">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <span>Sites visited</span>
                          </div>
                          <div className="cal-detail-tags-list">
                            {ev.workActivity.sites.map((s, i) => (
                              <span key={i} className="cal-detail-site">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Files Changed */}
                {ev.workActivity?.filesChanged?.length > 0 && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-work">
                      <div className="cal-detail-work-section">
                        <div className="cal-detail-work-heading">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span>Files changed</span>
                          <span className="cal-detail-work-stat">
                            <span className="cal-detail-additions">+{ev.workActivity.filesChanged.reduce((s, f) => s + f.additions, 0)}</span>
                            <span className="cal-detail-deletions">-{ev.workActivity.filesChanged.reduce((s, f) => s + f.deletions, 0)}</span>
                          </span>
                        </div>
                        <div className="cal-detail-files">
                          {ev.workActivity.filesChanged.map((f, i) => (
                            <div key={i} className="cal-detail-file">
                              <span className="cal-detail-file-name">{f.name}</span>
                              <span className="cal-detail-file-diff">
                                <span className="cal-detail-additions">+{f.additions}</span>
                                <span className="cal-detail-deletions">-{f.deletions}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity & Logs — collapsible */}
                <div className="cal-detail-section">
                  <button className="cal-detail-activity-toggle" onClick={() => setActivityExpanded(prev => !prev)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: activityExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className="cal-overlay-col-title" style={{ margin: 0 }}>Activity & Logs</span>
                    {summary.logs.length > 0 && <span className="cal-detail-activity-count">{summary.logs.length}</span>}
                  </button>
                  {activityExpanded && (
                    <div className="cal-detail-activity-body">
                      {summary.logs.length === 0 ? (
                        <div className="cal-overlay-empty">No activity logged during this event</div>
                      ) : (
                        <div className="cal-overlay-logs">
                          {summary.logs.map(log => (
                            <div key={log.id} className={`cal-overlay-log cal-overlay-log--${log.type}`}>
                              <span className="cal-overlay-log-time">{formatTimeDisplay(log.time)}</span>
                              <span className={`cal-overlay-log-dot cal-overlay-log-dot--${log.type}`} />
                              <span className="cal-overlay-log-action">{log.action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── VIEW MODE 0: Time Grid ── */}
      {viewMode === 0 && (<>
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
                {hour > 0 && hour % labelStride === 0 && <span>{formatHourLabel(hour)}</span>}
              </div>
            ))}
            {/* Sub-hour gutter labels — fade in with zoom. :30 appears first,
               then :15 and :45 as the user zooms in further. */}
            {halfOpacity > 0.01 && HOURS.map(hour => (
              <div
                key={`sub-${hour}-30`}
                className="cal-subtick-label cal-subtick-label--half"
                style={{ top: `${((hour * 60 + 30) / 60) * zoomLevel}px`, opacity: halfOpacity * 0.75 }}
              >:30</div>
            ))}
            {quarterOpacity > 0.01 && HOURS.flatMap(hour => [
              <div
                key={`sub-${hour}-15`}
                className="cal-subtick-label cal-subtick-label--quarter"
                style={{ top: `${((hour * 60 + 15) / 60) * zoomLevel}px`, opacity: quarterOpacity * 0.55 }}
              >:15</div>,
              <div
                key={`sub-${hour}-45`}
                className="cal-subtick-label cal-subtick-label--quarter"
                style={{ top: `${((hour * 60 + 45) / 60) * zoomLevel}px`, opacity: quarterOpacity * 0.55 }}
              >:45</div>,
            ])}
          </div>

          <div className={`cal-day-col cal-day-col--${dayRelation}`} onClick={handleSlotClick}>
            {HOURS.map(hour => (
              <div key={hour} className="cal-hour-slot" style={{ height: `${zoomLevel}px` }} />
            ))}
            {/* Sub-hour grid lines — dashed hairlines that fade in with zoom.
               30-min ticks are stronger than 15-min ticks. z-index 1 so they
               sit above the hour slots but below events (z 2+). */}
            {halfOpacity > 0.01 && HOURS.map(hour => (
              <div
                key={`tick-${hour}-30`}
                className="cal-subtick cal-subtick--half"
                style={{ top: `${((hour * 60 + 30) / 60) * zoomLevel}px`, opacity: halfOpacity }}
              />
            ))}
            {quarterOpacity > 0.01 && HOURS.flatMap(hour => [
              <div
                key={`tick-${hour}-15`}
                className="cal-subtick cal-subtick--quarter"
                style={{ top: `${((hour * 60 + 15) / 60) * zoomLevel}px`, opacity: quarterOpacity * 0.7 }}
              />,
              <div
                key={`tick-${hour}-45`}
                className="cal-subtick cal-subtick--quarter"
                style={{ top: `${((hour * 60 + 45) / 60) * zoomLevel}px`, opacity: quarterOpacity * 0.7 }}
              />,
            ])}

            {/* Thought blocks — click to inline-edit, hover reveals delete */}
            {thoughtSlots.map(slot => {
              const [h, m] = slot.time.split(':').map(Number)
              const minutes = h * 60 + m
              const topOffset = (minutes / 60) * zoomLevel
              const lastItem = slot.items[slot.items.length - 1]
              const isEditing = editingNote?.id === lastItem.id
              const commitEdit = () => {
                const t = (editingNote?.text || '').trim()
                if (t && t !== lastItem.text && onThoughtUpdate) onThoughtUpdate(slot.time, lastItem.id, t)
                setEditingNote(null)
              }
              return (
                <div
                  key={slot.time}
                  className={`cal-thought-block ${isEditing ? 'editing' : ''}`}
                  style={{ top: `${topOffset}px` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isEditing) setEditingNote({ id: lastItem.id, text: lastItem.text })
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
                  {isEditing ? (
                    <input
                      className="cal-thought-edit-input"
                      value={editingNote.text}
                      autoFocus
                      onChange={(e) => setEditingNote({ id: lastItem.id, text: e.target.value })}
                      onBlur={commitEdit}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                        else if (e.key === 'Escape') { e.preventDefault(); setEditingNote(null) }
                      }}
                    />
                  ) : (
                    <span className="cal-thought-preview">{lastItem.text}</span>
                  )}
                  {slot.items.length > 1 && !isEditing && <span className="cal-thought-count">+{slot.items.length - 1}</span>}
                  <button
                    className="cal-thought-del"
                    title="Delete note"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onThoughtDelete) onThoughtDelete(slot.time, lastItem.id)
                      setEditingNote(null)
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              )
            })}

            {/* Quick-note composer — appears when an empty slot is clicked.
                Type + Enter adds a thought that persists as a thought-block.
                If the clicked slot already has thoughts, the composer expands
                to show them with inline delete/edit. */}
            {quickSlot && (() => {
              const [h, m] = quickSlot.time.split(':').map(Number)
              const minutes = h * 60 + m
              const topOffset = (minutes / 60) * zoomLevel
              const existing = thoughtSlots.find(s => s.time === quickSlot.time)
              const submit = () => {
                const text = quickNoteText.trim()
                if (!text) return
                if (onQuickNoteAdd) onQuickNoteAdd(quickSlot.time, text)
                setQuickNoteText('')
                if (!existing && onQuickSlotClear) onQuickSlotClear()
              }
              const cancel = () => {
                setQuickNoteText('')
                if (onQuickSlotClear) onQuickSlotClear()
              }
              if (!existing) {
                return (
                  <input
                    ref={quickNoteInputRef}
                    className="cal-quick-slot-inline"
                    style={{ top: `${topOffset}px` }}
                    type="text"
                    value={quickNoteText}
                    placeholder="Jot a note — Enter to save, Esc to cancel"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    onBlur={() => { if (!quickNoteText.trim()) cancel() }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') { e.preventDefault(); submit() }
                      else if (e.key === 'Escape') { e.preventDefault(); cancel() }
                    }}
                  />
                )
              }
              // When clicking a slot that already has a thought, inline edit
              // happens on the thought-block itself — no popup is rendered here.
              return null
            })()}

            {/* Event blocks — collapsed: title + time only (progressive disclosure).
                viewMode 1 shows expanded cards with full text + summary. */}
            {tasks.map((task) => {
              const isDragged = dragInfo?.eventId === task.id
              const isResized = resizeInfo?.eventId === task.id
              const displayTime = isDragged ? dragInfo.newTime : task.time
              const displayEndTime = isDragged ? dragInfo.newEndTime : (isResized ? resizeInfo.newEndTime : task.endTime)

              const startMin = timeToMinutes(displayTime)
              const endMin = timeToMinutes(displayEndTime)
              const duration = endMin - startMin
              const topOffset = (startMin / 60) * zoomLevel
              const height = (duration / 60) * zoomLevel
              const color = eventColors[task.colorIndex] || eventColors[0]
              const isExpanded = expandedEvent === task.id
              const temporal = getTemporalState(task)
              const layout = overlapLayout[task.id] || { col: 0, totalCols: 1 }

              const eventStyle = {
                top: `${topOffset}px`,
                minHeight: `${Math.max(height, 24)}px`,
                height: `${Math.max(height, 24)}px`,
                '--ev-bg': color.bg,
                '--ev-border': color.border,
                '--ev-text': color.text,
                borderLeft: `4px solid ${color.border}`,
              }
              if (layout.totalCols > 1) {
                const pct = 100 / layout.totalCols
                eventStyle.left = `${layout.col * pct}%`
                eventStyle.width = `calc(${pct}% - ${layout.col === layout.totalCols - 1 ? 8 : 2}px)`
                eventStyle.right = 'auto'
              }

              return (
                <div
                  key={task.id}
                  className={`cal-event-block cal-event-block--${temporal} ${selectedEvent?.id === task.id ? 'selected' : ''} ${isExpanded ? 'is-overlay-source' : ''} ${isDragged ? 'is-dragging' : ''} ${isResized ? 'is-resizing' : ''}`}
                  style={eventStyle}
                  onClick={(e) => handleEventClick(e, task)}
                  onMouseDown={(e) => {
                    if (e.target.closest('.cal-resize-handle')) return
                    handleDragStart(e, task)
                  }}
                  onMouseEnter={() => { if (!dragInfo && !resizeInfo) handleEventEnter(task) }}
                  onMouseLeave={handleEventLeave}
                >
                  <span className="cal-event-title" style={{ color: color.text }}>{task.title}</span>
                  <span className="cal-event-time" style={{ color: color.text }}>
                    {formatTimeDisplay(displayTime)} – {formatTimeDisplay(displayEndTime)}
                  </span>
                  <div
                    className="cal-resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, task)}
                  />
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

              <div className="cal-detail-stacked">
                {/* Summary */}
                {expandedTask.aiSummary && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta-row cal-detail-summary-row">
                      <span className="cal-detail-meta-label">Summary</span>
                      <span className="cal-detail-meta-value">
                        {(() => {
                          const { truncated, isTruncated } = truncateWords(expandedTask.aiSummary)
                          return <>
                            {summaryExpanded ? expandedTask.aiSummary : truncated}
                            {isTruncated && (
                              <button className="cal-detail-read-more" onClick={() => setSummaryExpanded(prev => !prev)}>
                                {summaryExpanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </>
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Planned / Done / Docs / Agent */}
                {(expandedSummary.approachSummary || expandedSummary.features.length > 0 || expandedSummary.agentSummary) && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-meta">
                      {expandedSummary.approachSummary && (
                        <>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Planned</span>
                            <span className="cal-detail-meta-value">{expandedSummary.approachSummary.plannedText}</span>
                          </div>
                          <div className="cal-detail-meta-row">
                            <span className="cal-detail-meta-label">Done</span>
                            <span className="cal-detail-meta-value">{expandedSummary.approachSummary.doneText}</span>
                          </div>
                        </>
                      )}
                      {expandedSummary.features.length > 0 && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Docs</span>
                          <span className="cal-detail-meta-value">{expandedSummary.features.map(f => f.title).join(', ')}</span>
                        </div>
                      )}
                      {expandedSummary.agentSummary && (
                        <div className="cal-detail-meta-row">
                          <span className="cal-detail-meta-label">Agent</span>
                          <span className="cal-detail-meta-value cal-detail-meta-value--italic">{expandedSummary.agentSummary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabs / Sites */}
                {expandedTask.workActivity && (expandedTask.workActivity.tabs?.length > 0 || expandedTask.workActivity.sites?.length > 0) && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-work">
                      {expandedTask.workActivity.tabs && expandedTask.workActivity.tabs.length > 0 && (
                        <div className="cal-detail-work-section">
                          <div className="cal-detail-work-heading">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                            <span>Tabs opened</span>
                          </div>
                          <div className="cal-detail-tags-list">
                            {expandedTask.workActivity.tabs.map((t, i) => (
                              <span key={i} className="cal-detail-tag">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {expandedTask.workActivity.sites && expandedTask.workActivity.sites.length > 0 && (
                        <div className="cal-detail-work-section">
                          <div className="cal-detail-work-heading">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <span>Sites visited</span>
                          </div>
                          <div className="cal-detail-tags-list">
                            {expandedTask.workActivity.sites.map((s, i) => (
                              <span key={i} className="cal-detail-site">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Files Changed */}
                {expandedTask.workActivity?.filesChanged?.length > 0 && (
                  <div className="cal-detail-section">
                    <div className="cal-detail-work">
                      <div className="cal-detail-work-section">
                        <div className="cal-detail-work-heading">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span>Files changed</span>
                          <span className="cal-detail-work-stat">
                            <span className="cal-detail-additions">+{expandedTask.workActivity.filesChanged.reduce((s, f) => s + f.additions, 0)}</span>
                            <span className="cal-detail-deletions">-{expandedTask.workActivity.filesChanged.reduce((s, f) => s + f.deletions, 0)}</span>
                          </span>
                        </div>
                        <div className="cal-detail-files">
                          {expandedTask.workActivity.filesChanged.map((f, i) => (
                            <div key={i} className="cal-detail-file">
                              <span className="cal-detail-file-name">{f.name}</span>
                              <span className="cal-detail-file-diff">
                                <span className="cal-detail-additions">+{f.additions}</span>
                                <span className="cal-detail-deletions">-{f.deletions}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="cal-detail-section">
                  <button className="cal-detail-activity-toggle" onClick={() => setActivityExpanded(prev => !prev)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: activityExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className="cal-overlay-col-title" style={{ margin: 0 }}>Activity & Logs</span>
                    {expandedSummary.logs.length > 0 && <span className="cal-detail-activity-count">{expandedSummary.logs.length}</span>}
                  </button>
                  {activityExpanded && (
                    <div className="cal-detail-activity-body">
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
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      </>)}
      </>)}

      {/* Unified Command Bar */}
      <CommandBar
        onScheduleEvent={onScheduleEvent}
        existingEvents={{ ...calendarTasks, ...userEvents }}
        userEvents={userEvents}
        dateStr={dateStr}
        onJumpToDate={handleJumpToDate}
        onSearchResults={handleSearchResults}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
      />
    </div>
  )
}
