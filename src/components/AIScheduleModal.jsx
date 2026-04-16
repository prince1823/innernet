import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { parseEventWithAI } from '../utils/parseEventAI'
import { eventColors } from '../data/sampleData'
import './AIScheduleModal.css'

function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function addMinutesToTimeStr(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.min(23, Math.floor(total / 60))
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export default function AIScheduleModal({ open, onClose, onScheduleEvent, existingEvents = [] }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [pendingEvent, setPendingEvent] = useState(null)
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const TODAY_STR = formatDateStr(new Date(2026, 3, 16))

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setMessages([])
      setPendingEvent(null)
      setInput('')
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const detectConflicts = (date, time, endTime) => {
    if (!date || !time || !endTime) return []
    const dayEvents = existingEvents[date] || []
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const newStart = toMin(time)
    const newEnd = toMin(endTime)
    return dayEvents.filter(ev => {
      const evStart = toMin(ev.time)
      const evEnd = toMin(ev.endTime)
      return newStart < evEnd && newEnd > evStart
    })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
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
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    if (!pendingEvent || !pendingEvent.date || !pendingEvent.time) return

    const duration = pendingEvent.duration || 60
    const endTime = addMinutesToTimeStr(pendingEvent.time, duration)
    const title = pendingEvent.title ||
      (pendingEvent.attendees?.length
        ? `Meeting with ${pendingEvent.attendees.join(', ')}`
        : pendingEvent.eventType || 'Event')

    const newEvent = {
      id: `AI-${Date.now().toString(36)}`,
      title,
      time: pendingEvent.time,
      endTime,
      colorIndex: 4,
      tags: [],
      attendees: pendingEvent.attendees || [],
      userCreated: true,
      location: pendingEvent.location || null,
      description: pendingEvent.description || null,
    }

    onScheduleEvent(pendingEvent.date, newEvent)

    setMessages(prev => [...prev, {
      role: 'success',
      content: `"${title}" scheduled for ${formatTimeDisplay(pendingEvent.time)} – ${formatTimeDisplay(endTime)}`,
      date: pendingEvent.date,
    }])
    setPendingEvent(null)
  }

  const handleCancel = () => {
    setPendingEvent(null)
    setMessages(prev => [...prev, { role: 'system', content: 'Event cancelled. Type something new to schedule.' }])
  }

  if (!open) return null

  return createPortal(
    <div className="ai-schedule-overlay" onClick={onClose}>
      <div className="ai-schedule-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-schedule-header">
          <div className="ai-schedule-header-left">
            <div className="ai-schedule-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
              </svg>
            </div>
            <span className="ai-schedule-title">AI Schedule</span>
          </div>
          <button className="ai-schedule-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="ai-schedule-messages">
          {messages.length === 0 && (
            <div className="ai-schedule-welcome">
              <div className="ai-schedule-welcome-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <p className="ai-schedule-welcome-text">Type anything to schedule an event</p>
              <div className="ai-schedule-examples">
                {[
                  'Meeting with Tanuj tomorrow at 3pm',
                  'Book a 90min design review on Friday at the office',
                  'Weekly standup every Monday 10am with the team',
                  'Block 2 hours for deep work tomorrow afternoon',
                ].map(ex => (
                  <button key={ex} className="ai-schedule-example" onClick={() => { setInput(ex); inputRef.current?.focus() }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ai-msg--${msg.role}`}>
              {msg.role === 'user' && (
                <div className="ai-msg-user">{msg.content}</div>
              )}

              {msg.role === 'error' && (
                <div className="ai-msg-error">{msg.content}</div>
              )}

              {msg.role === 'system' && (
                <div className="ai-msg-system">{msg.content}</div>
              )}

              {msg.role === 'success' && (
                <div className="ai-msg-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>{msg.content}</span>
                </div>
              )}

              {msg.role === 'event-card' && (() => {
                const ev = msg.data
                const isLatestCard = i === messages.length - 1 || !messages.slice(i + 1).some(m => m.role === 'event-card')
                const endTime = ev.time ? addMinutesToTimeStr(ev.time, ev.duration || 60) : null
                const conflicts = ev.date && ev.time && endTime ? detectConflicts(ev.date, ev.time, endTime) : []
                const dateObj = ev.date ? new Date(ev.date + 'T00:00:00') : null
                const dateLabel = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not set'

                return (
                  <div className={`ai-event-card ${msg.isUpdate ? 'ai-event-card--updated' : ''}`}>
                    {msg.isUpdate && <div className="ai-event-card-badge">Updated</div>}
                    <div className="ai-event-card-title">{ev.title || 'Untitled Event'}</div>

                    <div className="ai-event-card-rows">
                      <div className="ai-event-card-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>{dateLabel}</span>
                      </div>

                      {ev.time && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span>{formatTimeDisplay(ev.time)} – {formatTimeDisplay(endTime)}</span>
                          <span className="ai-event-card-duration">{ev.duration || 60} min</span>
                        </div>
                      )}

                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          <span>{ev.attendees.join(', ')}</span>
                        </div>
                      )}

                      {ev.location && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span>{ev.location}</span>
                        </div>
                      )}

                      {ev.description && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                          <span>{ev.description}</span>
                        </div>
                      )}

                      {ev.recurrence && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                          <span>Repeats {ev.recurrence.type}{ev.recurrence.interval > 1 ? ` every ${ev.recurrence.interval}` : ''}</span>
                        </div>
                      )}

                      {ev.reminder && (
                        <div className="ai-event-card-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                          <span>{ev.reminder} min before</span>
                        </div>
                      )}
                    </div>

                    {conflicts.length > 0 && (
                      <div className="ai-event-card-conflict">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>Conflicts with: {conflicts.map(c => c.title).join(', ')}</span>
                      </div>
                    )}

                    {isLatestCard && pendingEvent && (
                      <div className="ai-event-card-actions">
                        <button className="ai-event-card-btn ai-event-card-btn--create" onClick={handleCreate}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Create Event
                        </button>
                        <button className="ai-event-card-btn ai-event-card-btn--cancel" onClick={handleCancel}>
                          Cancel
                        </button>
                      </div>
                    )}

                    {isLatestCard && pendingEvent && (
                      <div className="ai-event-card-hint">Type to modify — "add Priya", "make it 2pm", "change to 90 min"</div>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}

          {loading && (
            <div className="ai-msg ai-msg--loading">
              <div className="ai-loading-dots">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="ai-schedule-input-area">
          <input
            ref={inputRef}
            type="text"
            className="ai-schedule-input"
            placeholder={pendingEvent ? 'Modify this event — "add Priya", "move to 2pm"...' : 'Type to schedule — "meeting with Tanuj tomorrow 3pm"'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
            disabled={loading}
          />
          <button
            className="ai-schedule-send"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
