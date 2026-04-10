import { useState, useCallback } from 'react'
import CalendarPanel from './components/CalendarPanel'
import NotesPanel from './components/NotesPanel'
import { initialQuickNotes } from './data/sampleData'
import './App.css'

function App() {
  const [selectedDate, setSelectedDate] = useState('2026-04-09')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [quickNotes, setQuickNotes] = useState(initialQuickNotes)
  const [activeQuickNote, setActiveQuickNote] = useState(null)
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [bottomHeight, setBottomHeight] = useState(180)
  const [thoughtsText, setThoughtsText] = useState('')

  const handleSlotClick = (dateStr, timeStr) => {
    const existing = quickNotes.find(qn => qn.date === dateStr && qn.time === timeStr)
    if (existing) {
      setActiveQuickNote(existing)
    } else {
      const newNote = {
        id: `qn-${Date.now()}`,
        type: 'quicknote',
        date: dateStr,
        time: timeStr,
        content: '',
        createdAt: Date.now(),
      }
      setQuickNotes(prev => [...prev, newNote])
      setActiveQuickNote(newNote)
    }
    setSelectedEvent(null)
  }

  const handleSelectEvent = (event) => {
    setSelectedEvent(event)
    setActiveQuickNote(null)
  }

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = bottomHeight

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY
      const newHeight = Math.min(Math.max(startHeight + delta, 120), 500)
      setBottomHeight(newHeight)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [bottomHeight])

  return (
    <div className="app">
      {/* Left: Calendar sidebar */}
      <aside className="app-sidebar-calendar">
        <CalendarPanel selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedEvent={selectedEvent} setSelectedEvent={handleSelectEvent} quickNotes={quickNotes} activeQuickNote={activeQuickNote} onSlotClick={handleSlotClick} />
      </aside>

      {/* Right: Notes + Agent stacked */}
      <div className="app-main">
        {/* Top: Notes */}
        <div className="app-notes" style={{ flex: bottomCollapsed ? 1 : undefined, height: bottomCollapsed ? '100%' : undefined }}>
          <NotesPanel selectedDate={selectedDate} phase="calendar-notes" selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} activeQuickNote={activeQuickNote} setActiveQuickNote={setActiveQuickNote} quickNotes={quickNotes} setQuickNotes={setQuickNotes} />
        </div>

        {/* Resize handle + Bottom: Agent */}
        {!bottomCollapsed && (
          <>
            <div className="resize-handle" onMouseDown={handleResizeStart}>
              <div className="resize-grip" />
            </div>
            <div className="app-bottom" style={{ height: `${bottomHeight}px` }}>
              <div className="bottom-header">
                <div className="bottom-tabs">
                  <button className="bottom-tab active">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
                    Your Thoughts
                  </button>
                </div>
                <div className="bottom-header-right">
                  <span className="thoughts-date">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <button className="bottom-collapse-btn" onClick={() => setBottomCollapsed(true)} title="Collapse">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 15 12 9 18 15"/></svg>
                  </button>
                </div>
              </div>
              <div className="bottom-content">
                <textarea
                  className="thoughts-textarea"
                  placeholder="Write what you're thinking..."
                  value={thoughtsText}
                  onChange={(e) => setThoughtsText(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Collapsed bottom bar */}
        {bottomCollapsed && (
          <div className="bottom-collapsed-bar" onClick={() => setBottomCollapsed(false)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
            <span>Your Thoughts</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
