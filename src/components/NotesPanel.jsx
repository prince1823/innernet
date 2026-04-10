import { useState, useMemo, useEffect } from 'react'
import { notes, eventColors } from '../data/sampleData'
import './NotesPanel.css'

function formatTimeDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export default function NotesPanel({ selectedDate, phase, selectedEvent, setSelectedEvent, thoughts = [], quickSlot }) {
  const [expandedNote, setExpandedNote] = useState(null)
  const [expandedTopic, setExpandedTopic] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventSubTab, setEventSubTab] = useState('summary')

  // Reset sub-tab when switching events
  useEffect(() => {
    setEventSubTab('summary')
  }, [selectedEvent?.id])

  const filteredNotes = useMemo(() => {
    let filtered = notes
    if (phase === 'calendar-notes') {
      filtered = filtered.filter(n => n.date === selectedDate)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return filtered.sort((a, b) => b.date.localeCompare(a.date))
  }, [selectedDate, phase, searchQuery])

  const eventColor = selectedEvent ? (eventColors[selectedEvent.colorIndex] || eventColors[0]) : null

  const allActionTasks = selectedEvent?.actionItems?.flatMap(g => g.tasks) || []
  const doneCount = allActionTasks.filter(t => t.done).length
  const totalTodos = allActionTasks.length

  // QUICK SLOT VIEW — clicked on empty time slot
  if (quickSlot && !selectedEvent) {
    return (
      <div className="notes-panel">
        <div className="notes-header">
          <div className="notes-header-top">
            <h2 className="notes-title">Notes</h2>
            <span className="notes-date-pill">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="qs-header">
          <div className="qs-time-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{quickSlot.label}</span>
            <span className="qs-separator">·</span>
            <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="qs-content">
          {thoughts.length > 0 ? (
            <div className="qs-thoughts-list">
              {thoughts.map(t => (
                <div key={t.id} className="qs-thought">
                  <div className="qs-thought-dot" />
                  <span className="qs-thought-text">{t.text}</span>
                  <span className="qs-thought-time">{t.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="qs-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
              <p>Capture your thoughts</p>
              <span>Type in the bottom bar and press Enter</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // EVENT VIEW
  if (selectedEvent) {
    return (
      <div className="notes-panel">
        <div className="notes-header">
          <div className="notes-header-top">
            <h2 className="notes-title">Notes</h2>
            <span className="notes-date-pill">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Event header */}
        <div className="en-header" style={{ borderLeftColor: eventColor?.border }}>
          <div className="en-color-dot" style={{ background: eventColor?.border }} />
          <div className="en-header-info">
            <h3 className="en-title">{selectedEvent.title}</h3>
            <div className="en-time-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{formatTimeDisplay(selectedEvent.time)} – {formatTimeDisplay(selectedEvent.endTime)}</span>
              <span className="en-separator">·</span>
              <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="en-subtabs">
          <button className={`en-subtab ${eventSubTab === 'summary' ? 'active' : ''}`} onClick={() => setEventSubTab('summary')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            AI Summary
          </button>
          <button className={`en-subtab ${eventSubTab === 'notes' ? 'active' : ''}`} onClick={() => setEventSubTab('notes')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Notes
          </button>
          <button className={`en-subtab ${eventSubTab === 'transcript' ? 'active' : ''}`} onClick={() => setEventSubTab('transcript')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Transcript
          </button>
          <button className={`en-subtab ${eventSubTab === 'todos' ? 'active' : ''}`} onClick={() => setEventSubTab('todos')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Tasks
          </button>
        </div>

        {/* Tab content */}
        <div className="event-notes-scroll">

          {/* AI Summary tab */}
          {eventSubTab === 'summary' && (
            <div className="en-tab-content">
              {selectedEvent.aiSummary && (
                <div className="en-ai-summary">
                  <div className="en-ai-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    AI Summary
                  </div>
                  <p>{selectedEvent.aiSummary}</p>
                </div>
              )}
              {selectedEvent.tags && (
                <div className="en-tags-row">
                  {selectedEvent.tags.map(tag => (
                    <span key={tag} className="en-tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detailed Notes tab */}
          {eventSubTab === 'notes' && (
            <div className="en-tab-content">
              {selectedEvent.topicNotes && selectedEvent.topicNotes.length > 0 ? (
                <div className="en-doc">
                  {selectedEvent.notesTitle && (
                    <h3 className="en-doc-title">{selectedEvent.notesTitle}</h3>
                  )}
                  {selectedEvent.notesSummary && (
                    <p className="en-doc-summary">{selectedEvent.notesSummary}</p>
                  )}
                  <ul className="en-doc-topics">
                    {selectedEvent.topicNotes.map((topic, i) => (
                      <li key={i} className="en-doc-topic">
                        <div className="en-doc-topic-heading">
                          <span className="en-doc-topic-text">{topic.topic}</span>
                          {topic.timestamp && (
                            <span className="en-doc-timestamp">({topic.timestamp})</span>
                          )}
                        </div>
                        {topic.bullets && (
                          <ul className="en-doc-bullets">
                            {topic.bullets.map((bullet, j) => (
                              <li key={j} className="en-doc-bullet">{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="en-empty">No detailed notes for this event.</div>
              )}
            </div>
          )}

          {/* Transcription tab */}
          {eventSubTab === 'transcript' && (
            <div className="en-tab-content">
              {selectedEvent.transcription && selectedEvent.transcription.length > 0 ? (
                <div className="en-transcript">
                  {selectedEvent.transcription.map((line, i) => (
                    <div key={i} className="en-transcript-line">
                      <div className="en-tr-meta">
                        <span className="en-tr-time">{line.time}</span>
                        <span className={`en-tr-speaker ${line.speaker === 'You' ? 'you' : ''}`}>{line.speaker}</span>
                      </div>
                      <p className="en-tr-text">{line.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="en-empty">No transcription available for this event.</div>
              )}
            </div>
          )}

          {/* Action Items tab */}
          {eventSubTab === 'todos' && (
            <div className="en-tab-content">
              {selectedEvent.actionItems && selectedEvent.actionItems.length > 0 ? (
                <div className="en-action-items">
                  <div className="en-ai-heading-row">
                    <h4 className="en-ai-heading">Action items</h4>
                    <span className="en-ai-count">{doneCount}/{totalTodos}</span>
                  </div>
                  {selectedEvent.actionItems.map((group, gi) => (
                    <div key={gi} className="en-ai-group">
                      <h5 className="en-ai-person">{group.person}</h5>
                      <ul className="en-ai-tasks">
                        {group.tasks.map((task, ti) => (
                          <li key={ti} className="en-ai-task">
                            <span className="en-ai-task-text">{task.text}</span>
                            {task.timestamp && (
                              <span className="en-ai-task-time">({task.timestamp})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="en-empty">No action items for this event.</div>
              )}
            </div>
          )}

        </div>

      </div>
    )
  }

  // NO EVENT SELECTED — empty day fallback
  return (
    <div className="notes-panel">
      <div className="notes-header">
        <div className="notes-header-top">
          <h2 className="notes-title">Notes</h2>
          <span className="notes-date-pill">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
      <div className="notes-empty-day">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>No events for this day</p>
        <span>Select an event from the calendar to see notes</span>
      </div>
    </div>
  )
}
