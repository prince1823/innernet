import { useState, useRef, useEffect } from 'react'
import { activityLogs } from '../data/sampleData'
import './LogsPanel.css'

export default function LogsPanel({ extraLogs = [] }) {
  const [filter, setFilter] = useState('all')
  const filterOrder = ['all', 'user', 'agent', 'system']
  const cycleFilter = () => {
    setFilter(prev => {
      const idx = filterOrder.indexOf(prev)
      return filterOrder[(idx + 1) % filterOrder.length]
    })
  }
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

  // Format time to "Apr 9, 07:01" style
  const formatTimestamp = (time) => {
    return `Apr 9, ${time}`
  }

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <span className="logs-header-title">Activity</span>
        <button className="logs-filter-toggle" onClick={cycleFilter}>
          {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
        </button>
      </div>

      <div className="logs-content" ref={scrollRef}>
        <div className="logs-timeline">
          {filteredLogs.map((log, i) => (
            <div key={log.id || i} className="logs-entry">
              <div className="logs-dot-col">
                <span className={`logs-dot logs-dot-${log.type}`} />
                {i < filteredLogs.length - 1 && <span className="logs-connector" />}
              </div>
              <span className="logs-entry-text"><strong className={`logs-type-${log.type}`}>{log.type}:</strong> {log.action}</span>
              <span className="logs-entry-time">{formatTimestamp(log.time)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
