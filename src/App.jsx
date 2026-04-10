import { useState } from 'react'
import CalendarPanel from './components/CalendarPanel'
import NotesPanel from './components/NotesPanel'
import AgentPanel from './components/AgentPanel'
import './App.css'

function App() {
  const [phase, setPhase] = useState('calendar-notes')
  const [selectedDate, setSelectedDate] = useState('2026-04-09')
  const [selectedEvent, setSelectedEvent] = useState(null)

  return (
    <div className="app">
      <div className="main-area">
        <div className="phase-bar">
          <div className="phase-toggle">
            <button
              className={`phase-btn ${phase === 'calendar-notes' ? 'active' : ''}`}
              onClick={() => setPhase('calendar-notes')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Calendar & Notes
            </button>
            <button
              className={`phase-btn ${phase === 'notes-agent' ? 'active' : ''}`}
              onClick={() => setPhase('notes-agent')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Notes & Agent
            </button>
            <div className={`phase-slider ${phase}`} />
          </div>
        </div>

        <div className="panels-viewport">
          <div className={`panels-track phase-${phase}`}>
            <div className={`panel panel-calendar ${phase === 'calendar-notes' ? 'active' : ''}`}>
              <CalendarPanel selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} />
            </div>
            <div className="panel panel-notes active">
              <NotesPanel selectedDate={selectedDate} phase={phase} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} />
            </div>
            <div className={`panel panel-agent ${phase === 'notes-agent' ? 'active' : ''}`}>
              <AgentPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
