import { useState, useRef, useCallback } from 'react'
import { featureDocItems } from '../data/sampleData'
import './DocumentPanel.css'

// Flatten features into a flat document line model
function buildDocLines(features) {
  const lines = []
  features.forEach((feat, fi) => {
    lines.push({ id: `${feat.id}-title`, type: 'title', text: feat.title, featId: feat.id, featIdx: fi, status: feat.status, project: feat.project })
    if (feat.description) {
      lines.push({ id: `${feat.id}-desc`, type: 'description', text: feat.description, featId: feat.id })
    }
    feat.bullets.forEach((b, bi) => {
      lines.push({ id: `${feat.id}-b-${bi}`, type: 'bullet', text: b, featId: feat.id, bulletIdx: bi })
    })
    // AI-edited lines
    if (feat.aiLines) {
      feat.aiLines.forEach((al, ai) => {
        lines.push({ id: `${feat.id}-ai-${ai}`, type: 'ai-edit', text: al.text, original: al.original, status: al.status, featId: feat.id, aiIdx: ai })
      })
    }
  })
  return lines
}

const initialFeatures = featureDocItems.map(f => ({
  ...f,
  aiLines: f.id === 'feat-1' ? [
    { text: 'Add a "promise streak" counter that gamifies daily commitment tracking with visual indicators', original: null, status: 'suggested' },
    { text: 'Implement end-of-day comparison view: planned items (left) vs completed items (right) with color-coded diffs', original: null, status: 'accepted' },
  ] : [],
}))

export default function DocumentPanel({ onAskAI, onImplementAll, activeAgentFeatures = [] }) {
  const [features, setFeatures] = useState(initialFeatures)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [hoveredLine, setHoveredLine] = useState(null)
  const [aiLoadingLine, setAiLoadingLine] = useState(null)
  const editRef = useRef(null)

  const docLines = buildDocLines(features)

  const startEdit = useCallback((lineId, text) => {
    setEditingId(lineId)
    setEditText(text)
    setTimeout(() => editRef.current?.focus(), 20)
  }, [])

  const saveEdit = useCallback((lineId) => {
    const parts = lineId.split('-')
    const featId = parts.slice(0, 2).join('-')

    setFeatures(prev => prev.map(f => {
      if (f.id !== featId) return f
      if (lineId.endsWith('-title')) return { ...f, title: editText }
      if (lineId.endsWith('-desc')) return { ...f, description: editText }
      if (lineId.includes('-b-')) {
        const bi = parseInt(parts[parts.length - 1])
        const newBullets = [...f.bullets]
        newBullets[bi] = editText
        return { ...f, bullets: newBullets }
      }
      return f
    }))
    setEditingId(null)
    setEditText('')
  }, [editText])

  const handleKeyDown = useCallback((e, lineId) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(lineId) }
    if (e.key === 'Escape') { setEditingId(null); setEditText('') }
  }, [saveEdit])

  const addLine = useCallback((featId) => {
    setFeatures(prev => prev.map(f => {
      if (f.id !== featId) return f
      return { ...f, bullets: [...f.bullets, ''] }
    }))
    const f = features.find(ff => ff.id === featId)
    if (f) {
      const newId = `${featId}-b-${f.bullets.length}`
      setTimeout(() => startEdit(newId, ''), 30)
    }
  }, [features, startEdit])

  // Simulate AI edit on a specific line
  const handleLineAskAI = useCallback((line) => {
    setAiLoadingLine(line.id)
    // Simulate AI response after delay
    setTimeout(() => {
      setFeatures(prev => prev.map(f => {
        if (f.id !== line.featId) return f
        const aiLine = {
          text: `[AI suggestion] Enhanced: ${line.text.substring(0, 60)}...`,
          original: line.text,
          status: 'suggested',
        }
        return { ...f, aiLines: [...(f.aiLines || []), aiLine] }
      }))
      setAiLoadingLine(null)
    }, 800)
  }, [])

  const handleAiAction = useCallback((featId, aiIdx, action) => {
    setFeatures(prev => prev.map(f => {
      if (f.id !== featId) return f
      const newAiLines = [...(f.aiLines || [])]
      if (action === 'accept') {
        newAiLines[aiIdx] = { ...newAiLines[aiIdx], status: 'accepted' }
      } else {
        newAiLines.splice(aiIdx, 1)
      }
      return { ...f, aiLines: newAiLines }
    }))
  }, [])

  const statusColors = {
    'in-progress': { bg: '#fff3e0', text: '#e65100', label: 'In Progress' },
    'planned': { bg: '#e3f2fd', text: '#1565c0', label: 'Planned' },
    'done': { bg: '#e8f5e9', text: '#2e7d32', label: 'Done' },
  }

  return (
    <div className="doc-panel">
      {/* Toolbar */}
      <div className="doc-toolbar">
        <div className="doc-toolbar-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className="doc-toolbar-title">Feature Document</span>
        </div>
        <div className="doc-toolbar-right">
          <button className="doc-implement-all-btn" onClick={onImplementAll}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Implement All
          </button>
        </div>
      </div>

      {/* Document Body - Google Docs style */}
      <div className="doc-body">
        <div className="doc-page">
          {docLines.map((line) => {
            const isEditing = editingId === line.id
            const isHovered = hoveredLine === line.id
            const isAiLoading = aiLoadingLine === line.id

            if (line.type === 'title') {
              const sc = statusColors[line.status] || statusColors.planned
              const hasAgent = activeAgentFeatures.includes(line.featId)
              return (
                <div
                  key={line.id}
                  className={`doc-line doc-line-title ${isHovered ? 'hovered' : ''} ${hasAgent ? 'has-agent' : ''}`}
                  onMouseEnter={() => setHoveredLine(line.id)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <div className="doc-line-gutter">
                    <span className="doc-line-num">{line.featIdx + 1}.</span>
                  </div>
                  <div className="doc-line-content">
                    {isEditing ? (
                      <input
                        ref={editRef}
                        className="doc-edit-input doc-edit-title"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => saveEdit(line.id)}
                        onKeyDown={e => handleKeyDown(e, line.id)}
                      />
                    ) : (
                      <h2 className="doc-title-text" onClick={() => startEdit(line.id, line.text)}>
                        {line.text}
                      </h2>
                    )}
                    <div className="doc-line-tags">
                      <span className="doc-status-tag" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                      {line.project && <span className="doc-project-tag">#{line.project}</span>}
                      {hasAgent && <span className="doc-agent-tag">Agent active</span>}
                    </div>
                  </div>
                  {isHovered && !isEditing && (
                    <div className="doc-line-actions">
                      <button className="doc-line-implement-btn" onClick={() => onAskAI(line.featId, line.text, features.find(f => f.id === line.featId)?.bullets?.join('\n'))}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Implement
                      </button>
                      <button className="doc-line-ai-btn" onClick={() => onAskAI(line.featId, line.text, features.find(f => f.id === line.featId)?.bullets?.join('\n'))}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        Ask AI
                      </button>
                    </div>
                  )}
                </div>
              )
            }

            if (line.type === 'description') {
              return (
                <div
                  key={line.id}
                  className={`doc-line doc-line-desc ${isHovered ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredLine(line.id)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <div className="doc-line-gutter" />
                  <div className="doc-line-content">
                    {isEditing ? (
                      <input
                        ref={editRef}
                        className="doc-edit-input doc-edit-desc"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => saveEdit(line.id)}
                        onKeyDown={e => handleKeyDown(e, line.id)}
                      />
                    ) : (
                      <p className="doc-desc-text" onClick={() => startEdit(line.id, line.text)}>{line.text}</p>
                    )}
                  </div>
                  {isHovered && !isEditing && (
                    <button className="doc-line-ai-btn" onClick={() => handleLineAskAI(line)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {isAiLoading ? '...' : 'Ask AI'}
                    </button>
                  )}
                </div>
              )
            }

            if (line.type === 'bullet') {
              return (
                <div
                  key={line.id}
                  className={`doc-line doc-line-bullet ${isHovered ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredLine(line.id)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  <div className="doc-line-gutter">
                    <span className="doc-bullet-dot" />
                  </div>
                  <div className="doc-line-content">
                    {isEditing ? (
                      <input
                        ref={editRef}
                        className="doc-edit-input"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => saveEdit(line.id)}
                        onKeyDown={e => handleKeyDown(e, line.id)}
                      />
                    ) : (
                      <span className="doc-bullet-text" onClick={() => startEdit(line.id, line.text)}>
                        {line.text || <span className="doc-placeholder">Type something...</span>}
                      </span>
                    )}
                  </div>
                  {isHovered && !isEditing && (
                    <button className="doc-line-ai-btn" onClick={() => handleLineAskAI(line)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {isAiLoading ? '...' : 'Ask AI'}
                    </button>
                  )}
                </div>
              )
            }

            if (line.type === 'ai-edit') {
              return (
                <div key={line.id} className={`doc-line doc-line-ai ${line.status}`}>
                  <div className="doc-line-gutter">
                    <svg className="doc-ai-line-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div className="doc-line-content">
                    <span className="doc-ai-text">{line.text}</span>
                    {line.status === 'suggested' && (
                      <div className="doc-ai-line-actions">
                        <button className="doc-ai-accept" onClick={() => handleAiAction(line.featId, line.aiIdx, 'accept')}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          Accept
                        </button>
                        <button className="doc-ai-dismiss" onClick={() => handleAiAction(line.featId, line.aiIdx, 'dismiss')}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Dismiss
                        </button>
                      </div>
                    )}
                    {line.status === 'accepted' && (
                      <span className="doc-ai-accepted-badge">Accepted</span>
                    )}
                  </div>
                </div>
              )
            }

            return null
          })}

          {/* Add new line at end of each feature */}
          {features.map(feat => (
            <div key={`add-${feat.id}`} className="doc-line doc-line-add" onClick={() => addLine(feat.id)}>
              <div className="doc-line-gutter" />
              <div className="doc-line-content">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add a line</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
