import { useState, useRef, useEffect } from 'react'
import { activityLogs } from '../data/sampleData'
import './LogsPanel.css'

export default function LogsPanel({ extraLogs = [] }) {
  const [filter, setFilter] = useState('all') // all, user, agent, system
  const scrollRef = useRef(null)

  const allLogs = [...activityLogs, ...extraLogs]

  const filteredLogs = filter === 'all'
    ? allLogs
    : allLogs.filter(l => l.type === filter)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLogs.length])

  const typeIcon = (type) => {
    switch (type) {
      case 'user':
        return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      case 'agent':
        return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      case 'system':
        return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      default:
        return null
    }
  }

  const typeColor = (type) => {
    switch (type) {
      case 'user': return '#3b82f6'
      case 'agent': return '#8b5cf6'
      case 'system': return '#6b7280'
      default: return '#6b7280'
    }
  }

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <div className="logs-header-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          <span className="logs-header-title">Logs & Activity</span>
        </div>
        <div className="logs-filters">
          {['all', 'user', 'agent', 'system'].map(f => (
            <button key={f} className={`logs-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="logs-content" ref={scrollRef}>
        {filteredLogs.map((log, i) => (
          <div key={log.id || i} className={`logs-line logs-type-${log.type}`}>
            <span className="logs-time">{log.time}</span>
            <span className="logs-type-icon" style={{ color: typeColor(log.type) }}>
              {typeIcon(log.type)}
            </span>
            <span className="logs-type-label" style={{ color: typeColor(log.type) }}>[{log.type}]</span>
            <span className="logs-action">{log.action}</span>
            {log.session && <span className="logs-session">{log.session}</span>}
          </div>
        ))}
        <div className="logs-cursor">
          <span className="logs-cursor-char">_</span>
        </div>
      </div>
    </div>
  )
}
