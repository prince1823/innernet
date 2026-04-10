import { useState, useMemo } from 'react'
import { notes, eventColors } from '../data/sampleData'
import './NotesPanel.css'

function formatTimeDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export default function NotesPanel({ selectedDate, phase, selectedEvent, setSelectedEvent, activeQuickNote, setActiveQuickNote, quickNotes = [], setQuickNotes }) {
  const [expandedNote, setExpandedNote] = useState(null)
  const [expandedTopic, setExpandedTopic] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventSubTab, setEventSubTab] = useState('summary')

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

  const handleQuickNoteChange = (newContent) => {
    if (!activeQuickNote) return
    const updated = { ...activeQuickNote, content: newContent }
    setActiveQuickNote(updated)
    setQuickNotes(prev => prev.map(qn => qn.id === updated.id ? updated : qn))
  }

  const handleDeleteQuickNote = () => {
    if (!activeQuickNote) return
    setQuickNotes(prev => prev.filter(qn => qn.id !== activeQuickNote.id))
    setActiveQuickNote(null)
  }

  // QUICK NOTE EDITOR VIEW
  if (activeQuickNote) {
    return (
      <div className="notes-panel">
        <div className="notes-header">
          <div className="notes-header-top">
            <h2 className="notes-title">Quick Note</h2>
            <button className="notes-back-btn" onClick={() => setActiveQuickNote(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="qn-header">
          <div className="qn-time-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>{formatTimeDisplay(activeQuickNote.time)}</span>
            <span className="qn-separator">·</span>
            <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="qn-editor-area">
          <textarea
            className="qn-textarea"
            placeholder="What's on your mind?"
            value={activeQuickNote.content}
            onChange={(e) => handleQuickNoteChange(e.target.value)}
            autoFocus
          />
        </div>

        <div className="notes-footer">
          <button className="qn-delete-btn" onClick={handleDeleteQuickNote}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
          <button className="qn-done-btn" onClick={() => {
            // Auto-delete empty notes on close
            if (!activeQuickNote.content.trim()) {
              handleDeleteQuickNote()
            } else {
              setActiveQuickNote(null)
            }
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Done
          </button>
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
            <button className="notes-back-btn" onClick={() => { setSelectedEvent(null); setExpandedTopic(null); setEventSubTab('summary') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
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
          <button className={`en-subtab thoughts ${eventSubTab === 'thoughts' ? 'active' : ''}`} onClick={() => setEventSubTab('thoughts')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
            My Thoughts
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

          {/* My Thoughts tab */}
          {eventSubTab === 'thoughts' && (() => {
            const eventThought = quickNotes.find(qn => qn.date === selectedDate && qn.time === selectedEvent.time)
            return (
              <div className="en-tab-content en-thoughts-tab">
                <div className="en-thoughts-label">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
                  Your thoughts during this meeting
                </div>
                <textarea
                  className="en-thoughts-textarea"
                  placeholder="Write what you're thinking..."
                  value={eventThought?.content || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (eventThought) {
                      setQuickNotes(prev => prev.map(qn => qn.id === eventThought.id ? { ...qn, content: val } : qn))
                    } else {
                      const newNote = {
                        id: `qn-${Date.now()}`,
                        type: 'quicknote',
                        date: selectedDate,
                        time: selectedEvent.time,
                        content: val,
                        createdAt: Date.now(),
                      }
                      setQuickNotes(prev => [...prev, newNote])
                    }
                  }}
                />
              </div>
            )
          })()}

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

        <div className="notes-footer">
          <button className="add-note-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Note
          </button>
          <button className="summarize-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Summarize
          </button>
        </div>
      </div>
    )
  }

  // DEFAULT NOTES VIEW
  return (
    <div className="notes-panel">
      <div className="notes-header">
        <div className="notes-header-top">
          <h2 className="notes-title">Notes</h2>
          {phase === 'calendar-notes' && (
            <span className="notes-date-pill">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <div className="notes-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="notes-list">
        {filteredNotes.length > 0 ? filteredNotes.map(note => (
          <div key={note.id} className={`ncard ${note.author} ${expandedNote === note.id ? 'expanded' : ''}`} onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}>
            <div className="ncard-top">
              <div className={`ncard-icon ${note.author}`}>
                {note.author === 'ai' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                )}
              </div>
              <div className="ncard-meta">
                <span className="ncard-title">{note.title}</span>
                <div className="ncard-sub">
                  <span className={`author-badge ${note.author}`}>{note.author === 'ai' ? 'AI Generated' : 'Written by you'}</span>
                  <span className="ncard-date">{note.date}</span>
                </div>
              </div>
              <svg className="ncard-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div className="ncard-body">
              <p>{note.content}</p>
              {note.author === 'ai' && (
                <div className="ai-note-actions">
                  <button className="ai-action-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Regenerate</button>
                  <button className="ai-action-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
                </div>
              )}
            </div>
            <div className="ncard-tags">{note.tags.map(tag => (<span key={tag} className="ntag">#{tag}</span>))}</div>
          </div>
        )) : (
          <div className="notes-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>No notes found</p>
          </div>
        )}
      </div>

      <div className="notes-footer">
        <button className="add-note-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Note</button>
        <button className="summarize-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Summarize</button>
      </div>
    </div>
  )
}
