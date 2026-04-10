import { useState, useCallback, useEffect, useRef } from 'react'
import CalendarPanel from './components/CalendarPanel'
import NotesPanel from './components/NotesPanel'
import { calendarTasks } from './data/sampleData'
import './App.css'

function App() {
  const [selectedDate, setSelectedDate] = useState('2026-04-09')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [bottomHeight, setBottomHeight] = useState(180)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [thoughtsText, setThoughtsText] = useState('')
  const [thoughts, setThoughts] = useState({})
  const [quickSlot, setQuickSlot] = useState(null) // { time: '14:00', label: '2 PM' }
  const inputRef = useRef(null)

  // Auto-select first event of the day when date changes
  useEffect(() => {
    const dayEvents = calendarTasks[selectedDate] || []
    if (dayEvents.length > 0) {
      setSelectedEvent(dayEvents[0])
    } else {
      setSelectedEvent(null)
    }
    setQuickSlot(null)
  }, [selectedDate])

  const handleSlotClick = useCallback((time, label) => {
    setSelectedEvent(null)
    setQuickSlot({ time, label })
    // Auto-focus the input after state updates
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Thoughts key: event-specific, quick-slot, or date-level
  const thoughtsKey = selectedEvent ? `event-${selectedEvent.id}` : quickSlot ? `slot-${selectedDate}-${quickSlot.time}` : selectedDate

  // Clear input text when switching context
  useEffect(() => {
    setThoughtsText('')
  }, [thoughtsKey])

  const addThought = useCallback(() => {
    const text = thoughtsText.trim()
    if (!text) return
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    setThoughts(prev => ({
      ...prev,
      [thoughtsKey]: [...(prev[thoughtsKey] || []), { text, time, id: Date.now() }]
    }))
    setThoughtsText('')
  }, [thoughtsText, thoughtsKey])

  const currentThoughts = thoughts[thoughtsKey] || []

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
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [bottomHeight])

  const handleSidebarResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      const newWidth = Math.min(Math.max(startWidth + delta, 260), 600)
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  return (
    <div className="app">
      {/* Left: Calendar sidebar */}
      <aside className="app-sidebar-calendar" style={{ width: `${sidebarWidth}px` }}>
        <CalendarPanel selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedEvent={selectedEvent} setSelectedEvent={(ev) => { setSelectedEvent(ev); setQuickSlot(null) }} onSlotClick={handleSlotClick} quickSlot={quickSlot} thoughts={thoughts} />
      </aside>

      {/* Sidebar resize handle */}
      <div className="sidebar-resize-handle" onMouseDown={handleSidebarResizeStart} />

      {/* Right: Notes + Agent stacked */}
      <div className="app-main">
        {/* Top: Notes */}
        <div className="app-notes" style={{ flex: bottomCollapsed ? 1 : undefined, height: bottomCollapsed ? '100%' : undefined }}>
          <NotesPanel selectedDate={selectedDate} phase="calendar-notes" selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} thoughts={currentThoughts} quickSlot={quickSlot} />
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
                  <span className="thoughts-date">
                    {selectedEvent ? selectedEvent.title : quickSlot ? quickSlot.label : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <button className="bottom-collapse-btn" onClick={() => setBottomCollapsed(true)} title="Collapse">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 15 12 9 18 15"/></svg>
                  </button>
                </div>
              </div>
              <div className="bottom-content terminal-content">
                <div className="terminal-scroll">
                  {currentThoughts.map(t => (
                    <div key={t.id} className="terminal-line">
                      <span className="terminal-prompt-prefix">
                        <span className="terminal-date">{t.time}</span>
                        <span className="terminal-arrow">→</span>
                      </span>
                      <span className="terminal-output">{t.text}</span>
                    </div>
                  ))}
                  <div className="terminal-line terminal-input-line">
                    <span className="terminal-prompt-prefix">
                      <span className="terminal-date">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                      <span className="terminal-arrow">→</span>
                    </span>
                    <input
                      ref={inputRef}
                      className="terminal-input"
                      type="text"
                      placeholder="type your thought..."
                      value={thoughtsText}
                      onChange={(e) => setThoughtsText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addThought() }}
                    />
                  </div>
                </div>
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
