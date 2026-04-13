import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { calendarTasks, eventColors, notes as allNotes } from '../data/sampleData'
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

export default function CalendarPanel({ selectedDate, setSelectedDate, selectedEvent, setSelectedEvent, onSlotClick, quickSlot, thoughts = {}, onDatePanelOpen }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 9))
  const [showMiniCal, setShowMiniCal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(56) // pixels per hour: 42, 56, 84
  const gridRef = useRef(null)
  const searchRef = useRef(null)

  const dateStr = formatDateStr(currentDate)
  const isToday = dateStr === '2026-04-09'
  const headerLabel = `${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  const tasks = calendarTasks[dateStr] || []

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

  // Search logic
  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults(null)
      return
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
    setSearchResults(grouped)
  }, [])

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

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = zoomLevel * 7
  }, [currentDate, zoomLevel])

  useEffect(() => { setSelectedDate(dateStr) }, [dateStr])

  const handleEventClick = (e, event) => {
    e.stopPropagation()
    setSelectedEvent(event)
  }

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

  // Search results view
  if (searchResults) {
    const dates = Object.keys(searchResults).sort()
    return (
      <div className="calendar-panel">
        <div className="cal-header">
          <div className="cal-header-left" style={{ flex: 1 }}>
            <div className="cal-search-box active">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search #project or name..."
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
          {dates.length === 0 && (
            <div className="cal-search-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <p>No results found</p>
            </div>
          )}
          {dates.map(date => {
            const d = new Date(date + 'T00:00:00')
            return (
              <div key={date} className="cal-search-date-group">
                <div className="cal-search-date-header">
                  <span className="cal-search-date-day">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="cal-search-date-full">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                {searchResults[date].map(ev => {
                  const color = eventColors[ev.colorIndex] || eventColors[0]
                  return (
                    <div key={ev.id} className="cal-search-event" onClick={() => {
                      const nd = new Date(date + 'T00:00:00')
                      setCurrentDate(nd)
                      setSelectedEvent(ev)
                      setSearchResults(null)
                      setSearchQuery('')
                    }}>
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
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-panel">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <button className="cal-today-btn" onClick={goToToday}>Today</button>
          <button className="cal-arrow-btn" onClick={goToPrev}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="cal-date-title" onClick={() => setShowMiniCal(!showMiniCal)} style={{ cursor: 'pointer' }}>
            {headerLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, opacity: 0.5 }}><polyline points="6 9 12 15 18 9"/></svg>
          </h2>
          <button className="cal-arrow-btn" onClick={goToNext}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="cal-header-right">
          <button className="cal-search-btn" onClick={() => { setSearchResults({}); setTimeout(() => searchRef.current?.focus(), 50) }} title="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div className="cal-zoom-btns">
            <button className={`cal-zoom-btn ${zoomLevel === 42 ? 'active' : ''}`} onClick={() => setZoomLevel(42)} title="Compact">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <button className={`cal-zoom-btn ${zoomLevel === 56 ? 'active' : ''}`} onClick={() => setZoomLevel(56)} title="Normal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="20" y2="4"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
            </button>
            <button className={`cal-zoom-btn ${zoomLevel === 84 ? 'active' : ''}`} onClick={() => setZoomLevel(84)} title="Expanded">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
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

      {/* Day Info Bar */}
      <div className="cal-day-info" onClick={handleDateClick}>
        <div className="cal-day-info-left">
          <span className={`cal-day-info-num ${isToday ? 'today' : ''}`}>{currentDate.getDate()}</span>
          <div className="cal-day-info-text">
            <span className="cal-day-info-name">{DAYS_SHORT[currentDate.getDay()]}</span>
            <span className="cal-day-info-count">{tasks.length} event{tasks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="cal-day-info-right">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      {/* Time grid */}
      <div className="cal-grid-scroll" ref={gridRef}>
        <div className="cal-time-grid">
          <div className="cal-gutter">
            {HOURS.map(hour => (
              <div key={hour} className="cal-time-label" style={{ height: `${zoomLevel}px` }}>
                {hour > 0 && <span>{formatHourLabel(hour)}</span>}
              </div>
            ))}
          </div>

          <div className="cal-day-col" onClick={handleSlotClick}>
            {HOURS.map(hour => (
              <div key={hour} className="cal-hour-slot" style={{ height: `${zoomLevel}px` }} />
            ))}

            {/* Thought blocks */}
            {thoughtSlots.map(slot => {
              const [h, m] = slot.time.split(':').map(Number)
              const topOffset = ((h * 60 + m) / 60) * zoomLevel
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
              const topOffset = ((h * 60 + m) / 60) * zoomLevel
              return (
                <div className="cal-quick-slot" style={{ top: `${topOffset}px` }}>
                  <div className="cal-quick-slot-label">{quickSlot.label}</div>
                </div>
              )
            })()}

            {/* Event blocks */}
            {tasks.map((task) => {
              const startMin = timeToMinutes(task.time)
              const endMin = timeToMinutes(task.endTime)
              const duration = endMin - startMin
              const topOffset = (startMin / 60) * zoomLevel
              const height = (duration / 60) * zoomLevel
              const color = eventColors[task.colorIndex] || eventColors[0]

              return (
                <div
                  key={task.id}
                  className={`cal-event-block ${selectedEvent?.id === task.id ? 'selected' : ''}`}
                  style={{
                    top: `${topOffset}px`,
                    height: `${Math.max(height, 24)}px`,
                    backgroundColor: color.bg,
                    borderLeft: `4px solid ${color.border}`,
                  }}
                  onClick={(e) => handleEventClick(e, task)}
                >
                  <span className="cal-event-title" style={{ color: color.text }}>{task.title}</span>
                  <span className="cal-event-time" style={{ color: color.text }}>
                    {formatTimeDisplay(task.time)} – {formatTimeDisplay(task.endTime)}
                  </span>
                  <div className="cal-event-indicators">
                    <div className="cal-event-icons">
                      {task.topicNotes && (
                        <span className="cal-ind-icon" title="Notes" style={{ color: color.text }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </span>
                      )}
                      {task.transcription && (
                        <span className="cal-ind-icon" title="Transcript" style={{ color: color.text }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                        </span>
                      )}
                      {task.actionItems && task.actionItems.length > 0 && (() => {
                        const allTasks = task.actionItems.flatMap(g => g.tasks)
                        const done = allTasks.filter(t => t.done).length
                        return (
                          <span className="cal-ind-tasks" title={`${done}/${allTasks.length} tasks`} style={{ color: color.text }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            <span className="cal-ind-tasks-count">{done}/{allTasks.length}</span>
                          </span>
                        )
                      })()}
                      {task.project && (
                        <span className="cal-event-project" style={{ color: color.text }}>#{task.project}</span>
                      )}
                    </div>
                    {task.attendees && task.attendees.length > 0 && (
                      <div className="cal-event-avatars">
                        {task.attendees.slice(0, 3).map((name, ai) => (
                          <div key={ai} className="cal-avatar" title={name} style={{ background: color.border, zIndex: 3 - ai }}>
                            {name.charAt(0)}
                          </div>
                        ))}
                        {task.attendees.length > 3 && (
                          <div className="cal-avatar cal-avatar-more" style={{ background: `${color.border}88` }}>+{task.attendees.length - 3}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

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
    </div>
  )
}
