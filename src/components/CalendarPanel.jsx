import { useState, useMemo, useEffect, useRef } from 'react'
import { calendarTasks, calendarEvents, eventColors, notes as allNotes } from '../data/sampleData'
import './CalendarPanel.css'

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0 to 23

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

export default function CalendarPanel({ selectedDate, setSelectedDate, selectedEvent, setSelectedEvent }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 9))
  const gridRef = useRef(null)

  const dateStr = formatDateStr(currentDate)
  const isToday = dateStr === '2026-04-09'
  const dayName = DAYS_SHORT[currentDate.getDay()]
  const dayNum = currentDate.getDate()
  const headerLabel = `${dayNum} ${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  const tasks = calendarTasks[dateStr] || []

  const goToPrev = () => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
    setSelectedEvent(null)
  }

  const goToNext = () => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      return d
    })
    setSelectedEvent(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date(2026, 3, 9))
    setSelectedEvent(null)
  }

  // Scroll to ~7am on mount / date change
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 56 * 7 // 7am
    }
  }, [currentDate])

  useEffect(() => {
    setSelectedDate(dateStr)
  }, [dateStr])

  const handleEventClick = (e, event) => {
    e.stopPropagation()
    setSelectedEvent(event)
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
          <button className="cal-arrow-btn" onClick={goToNext}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <h2 className="cal-date-title">{headerLabel}</h2>
        </div>
        <div className="cal-header-right">
          <span className="cal-view-label">Day</span>
        </div>
      </div>

      {/* Day label row */}
      <div className="cal-day-label-row">
        <div className="cal-gutter-space" />
        <div className="cal-day-label">
          <span className={`cal-day-name ${isToday ? 'today' : ''}`}>{dayName}</span>
          <span className={`cal-day-num ${isToday ? 'today-num' : ''}`}>{dayNum}</span>
        </div>
      </div>

      {/* Time grid */}
      <div className="cal-grid-scroll" ref={gridRef}>
        <div className="cal-time-grid">
          {/* Time gutter + single day column */}
          <div className="cal-gutter">
            {HOURS.map(hour => (
              <div key={hour} className="cal-time-label">
                {hour > 0 && <span>{formatHourLabel(hour)}</span>}
              </div>
            ))}
          </div>

          <div className="cal-day-col">
            {/* Hour slots */}
            {HOURS.map(hour => (
              <div key={hour} className="cal-hour-slot" />
            ))}

            {/* Event blocks */}
            {tasks.map((task) => {
              const startMin = timeToMinutes(task.time)
              const endMin = timeToMinutes(task.endTime)
              const duration = endMin - startMin
              const topOffset = (startMin / 60) * 56
              const height = (duration / 60) * 56
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
                  {/* Indicator row: icons + task progress + avatars */}
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
                        const total = allTasks.length
                        return (
                          <span className="cal-ind-tasks" title={`${done}/${total} tasks`} style={{ color: color.text }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            <span className="cal-ind-tasks-count">{done}/{total}</span>
                          </span>
                        )
                      })()}
                    </div>
                    {task.attendees && task.attendees.length > 0 && (
                      <div className="cal-event-avatars">
                        {task.attendees.slice(0, 3).map((name, ai) => (
                          <div key={ai} className="cal-avatar" title={name} style={{ background: color.border, zIndex: 3 - ai }}>
                            {name.charAt(0)}
                          </div>
                        ))}
                        {task.attendees.length > 3 && (
                          <div className="cal-avatar cal-avatar-more" style={{ background: `${color.border}88` }}>
                            +{task.attendees.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Current time line */}
            {isToday && (
              <div
                className="cal-now-line"
                style={{ top: `${((10 * 60 + 10) / 60) * 56}px` }}
              >
                <div className="cal-now-dot" />
                <div className="cal-now-rule" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event details now shown in Notes panel */}
    </div>
  )
}
