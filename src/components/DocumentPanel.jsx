import { useState, useRef, useCallback, useEffect } from 'react'
import { featureDocItems } from '../data/sampleData'
import './DocumentPanel.css'

const initialFeatures = featureDocItems.map(f => ({
  ...f,
  aiLines: f.id === 'feat-1' ? [
    { text: 'Add a "promise streak" counter that gamifies daily commitment tracking with visual indicators', original: null, status: 'suggested' },
    { text: 'Implement end-of-day comparison view: planned items (left) vs completed items (right) with color-coded diffs', original: null, status: 'accepted' },
  ] : [],
}))

/* ── Selection save/restore for toolbar ── */
let savedRange = null
function saveSelection() {
  const sel = window.getSelection()
  if (sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0)
  }
}
function restoreSelection() {
  if (savedRange) {
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(savedRange)
  }
}

function execCmd(cmd, value = null) {
  restoreSelection()
  document.execCommand(cmd, false, value)
}

/* ── Toolbar components ── */
function TBtn({ children, title, cmd, onClick }) {
  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (cmd) execCmd(cmd)
    if (onClick) onClick(e)
  }
  return (
    <button className="gdoc-tb-btn" title={title} onMouseDown={handleClick}>
      {children}
    </button>
  )
}

function TDropdown({ value, width, title, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="gdoc-tb-dropdown-wrap" style={{ width }} ref={ref}>
      <div
        className="gdoc-tb-dropdown"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open) }}
      >
        <span className="gdoc-tb-dropdown-value">{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {open && options && (
        <div className="gdoc-tb-dropdown-menu">
          {options.map(opt => (
            <div
              key={opt.value}
              className="gdoc-tb-dropdown-item"
              style={opt.style}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TSep() {
  return <div className="gdoc-tb-sep" />
}

const headingOptions = [
  { value: 'p', label: 'Normal text', style: { fontSize: '13px' } },
  { value: 'h1', label: 'Heading 1', style: { fontSize: '20px', fontWeight: 700 } },
  { value: 'h2', label: 'Heading 2', style: { fontSize: '17px', fontWeight: 700 } },
  { value: 'h3', label: 'Heading 3', style: { fontSize: '14px', fontWeight: 700 } },
]

const fontOptions = [
  { value: 'Arial', label: 'Arial', style: { fontFamily: 'Arial' } },
  { value: 'Georgia', label: 'Georgia', style: { fontFamily: 'Georgia' } },
  { value: 'Times New Roman', label: 'Times New Roman', style: { fontFamily: 'Times New Roman' } },
  { value: 'Courier New', label: 'Courier New', style: { fontFamily: 'Courier New' } },
  { value: 'Verdana', label: 'Verdana', style: { fontFamily: 'Verdana' } },
]

export default function DocumentPanel({ onAskAI, onImplementAll, activeAgentFeatures = [] }) {
  const [features, setFeatures] = useState(initialFeatures)
  const [aiLoadingLine, setAiLoadingLine] = useState(null)
  const [fontSize, setFontSize] = useState(11)
  const [currentFont, setCurrentFont] = useState('Arial')
  const [currentHeading, setCurrentHeading] = useState('Normal text')
  const editorRef = useRef(null)
  const bodyRef = useRef(null)
  const overlayRef = useRef(null)
  const hoveredElRef = useRef(null)

  // Save selection whenever it changes inside the editor
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      if (sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        saveSelection()
      }
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  // Hover overlay — listen on the doc-body wrapper so overlay is included in hover zone
  useEffect(() => {
    const editor = editorRef.current
    const overlay = overlayRef.current
    const body = bodyRef.current
    if (!editor || !overlay || !body) return

    const getLineEl = (node) => {
      let el = node
      while (el && el !== editor) {
        if (el.dataset?.featId !== undefined) return el
        el = el.parentElement
      }
      return null
    }

    const showOverlay = (lineEl) => {
      if (hoveredElRef.current === lineEl) return
      hoveredElRef.current = lineEl
      const bodyRect = body.getBoundingClientRect()
      const lineRect = lineEl.getBoundingClientRect()
      const isTitle = lineEl.tagName === 'H2'

      overlay.style.display = 'flex'
      overlay.style.top = `${lineRect.top - bodyRect.top + body.scrollTop + (lineRect.height / 2) - 12}px`
      overlay.style.right = '8px'

      const implBtn = overlay.querySelector('.doc-overlay-implement')
      if (implBtn) implBtn.style.display = isTitle ? 'flex' : 'none'

      overlay.dataset.featId = lineEl.dataset.featId
      overlay.dataset.featIdx = lineEl.dataset.featIdx || ''
      overlay.dataset.text = lineEl.textContent
      overlay.dataset.isTitle = isTitle ? '1' : ''
    }

    const hideOverlay = () => {
      hoveredElRef.current = null
      overlay.style.display = 'none'
    }

    const isMouseOverOverlay = (e) => {
      if (overlay.style.display === 'none') return false
      const r = overlay.getBoundingClientRect()
      // Add generous padding so the gap between text and buttons doesn't trigger hide
      return (
        e.clientX >= r.left - 20 &&
        e.clientX <= r.right + 4 &&
        e.clientY >= r.top - 4 &&
        e.clientY <= r.bottom + 4
      )
    }

    const onMouseMove = (e) => {
      // If mouse is near or over the overlay, keep it visible
      if (isMouseOverOverlay(e)) return

      const lineEl = getLineEl(e.target)
      if (lineEl) {
        showOverlay(lineEl)
      } else {
        hideOverlay()
      }
    }

    const onMouseLeave = () => {
      hideOverlay()
    }

    body.addEventListener('mousemove', onMouseMove)
    body.addEventListener('mouseleave', onMouseLeave)
    return () => {
      body.removeEventListener('mousemove', onMouseMove)
      body.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Build initial HTML for the editor
  const buildInitialHTML = useCallback(() => {
    let html = ''
    features.forEach((feat, fi) => {
      html += `<h2 class="doc-title" data-feat-id="${feat.id}" data-feat-idx="${fi}">${feat.title}</h2>`
      if (feat.description) {
        html += `<p class="doc-desc" data-feat-id="${feat.id}">${feat.description}</p>`
      }
      feat.bullets.forEach((b, bi) => {
        html += `<p class="doc-bullet" data-feat-id="${feat.id}" data-bullet-idx="${bi}"><span class="doc-bullet-marker" contenteditable="false">&#8226;</span> ${b}</p>`
      })
    })
    return html
  }, []) // only on mount

  const [initialHTML] = useState(buildInitialHTML)

  const handleLineAskAI = useCallback((line) => {
    setAiLoadingLine(line.id)
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

  const handleHeadingChange = (val) => {
    if (val === 'p') {
      execCmd('formatBlock', '<p>')
      setCurrentHeading('Normal text')
    } else {
      execCmd('formatBlock', `<${val}>`)
      setCurrentHeading(headingOptions.find(h => h.value === val)?.label || 'Normal text')
    }
  }

  const handleFontChange = (val) => {
    execCmd('fontName', val)
    setCurrentFont(val)
  }

  const handleFontSizeChange = (delta) => {
    const newSize = Math.min(Math.max(fontSize + delta, 8), 96)
    setFontSize(newSize)
    restoreSelection()
    document.execCommand('fontSize', false, 7)
    const el = editorRef.current
    if (el) {
      const fonts = el.querySelectorAll('font[size="7"]')
      fonts.forEach(f => {
        f.removeAttribute('size')
        f.style.fontSize = `${newSize}px`
      })
    }
  }

  // Overlay button click handlers
  const handleOverlayAskAI = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const featId = overlay.dataset.featId
    const text = overlay.dataset.text
    const feat = features.find(f => f.id === featId)
    if (overlay.dataset.isTitle === '1') {
      onAskAI(featId, text, feat?.bullets?.join('\n'))
    } else {
      // For non-title lines, simulate inline AI
      handleLineAskAI({ id: featId + '-line', featId, text })
    }
  }, [features, onAskAI, handleLineAskAI])

  const handleOverlayImplement = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const featId = overlay.dataset.featId
    const text = overlay.dataset.text
    const feat = features.find(f => f.id === featId)
    onAskAI(featId, text, feat?.bullets?.join('\n'))
  }, [features, onAskAI])

  return (
    <div className="doc-panel">
      {/* ── Google Docs Formatting Toolbar ── */}
      <div className="gdoc-toolbar">
        <div className="gdoc-toolbar-row">
          <TDropdown value={currentHeading} width="110px" title="Styles" options={headingOptions} onSelect={handleHeadingChange} />
          <TSep />
          <TDropdown value={currentFont} width="100px" title="Font" options={fontOptions} onSelect={handleFontChange} />
          <TSep />

          <div className="gdoc-tb-fontsize">
            <button className="gdoc-tb-fontsize-btn" title="Decrease font size" onMouseDown={(e) => { e.preventDefault(); handleFontSizeChange(-1) }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span className="gdoc-tb-fontsize-val">{fontSize}</span>
            <button className="gdoc-tb-fontsize-btn" title="Increase font size" onMouseDown={(e) => { e.preventDefault(); handleFontSizeChange(1) }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <TSep />

          <TBtn title="Bold (Ctrl+B)" cmd="bold">
            <span style={{ fontWeight: 700, fontSize: '13px' }}>B</span>
          </TBtn>
          <TBtn title="Italic (Ctrl+I)" cmd="italic">
            <span style={{ fontWeight: 600, fontSize: '13px', fontStyle: 'italic' }}>I</span>
          </TBtn>
          <TBtn title="Underline (Ctrl+U)" cmd="underline">
            <span style={{ fontWeight: 600, fontSize: '13px', textDecoration: 'underline' }}>U</span>
          </TBtn>
          <TBtn title="Strikethrough" cmd="strikeThrough">
            <span style={{ fontWeight: 600, fontSize: '13px', textDecoration: 'line-through' }}>S</span>
          </TBtn>
          <TBtn title="Text color" onClick={() => {
            const color = prompt('Enter color (hex or name):', '#000000')
            if (color) execCmd('foreColor', color)
          }}>
            <div className="gdoc-tb-textcolor">
              <span style={{ fontWeight: 700, fontSize: '13px' }}>A</span>
              <div className="gdoc-tb-colorbar" />
            </div>
          </TBtn>
          <TBtn title="Highlight color" onClick={() => {
            const color = prompt('Enter highlight color:', '#ffff00')
            if (color) execCmd('hiliteColor', color)
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>
          </TBtn>
          <TSep />

          <TBtn title="Insert link (Ctrl+K)" onClick={() => {
            const url = prompt('Enter URL:')
            if (url) execCmd('createLink', url)
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </TBtn>
          <TSep />

          <TBtn title="Align left" cmd="justifyLeft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          </TBtn>
          <TBtn title="Align center" cmd="justifyCenter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </TBtn>
          <TBtn title="Align right" cmd="justifyRight">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
          </TBtn>
          <TSep />

          <TBtn title="Bulleted list" cmd="insertUnorderedList">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
          </TBtn>
          <TBtn title="Numbered list" cmd="insertOrderedList">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="600">3</text></svg>
          </TBtn>
          <TSep />

          <TBtn title="Undo (Ctrl+Z)" cmd="undo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </TBtn>
          <TBtn title="Redo (Ctrl+Y)" cmd="redo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
          </TBtn>

          <div className="gdoc-tb-spacer" />
          <button className="doc-implement-all-btn" onClick={onImplementAll}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Implement All
          </button>
        </div>
      </div>

      {/* ── Document body with floating overlay ── */}
      <div className="doc-body" ref={bodyRef}>
        <div
          ref={editorRef}
          className="doc-editor"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHTML }}
        />

        {/* Floating hover overlay — positioned via DOM, not React state */}
        <div ref={overlayRef} className="doc-line-overlay" style={{ display: 'none' }}>
          <button className="doc-overlay-implement doc-line-implement-btn" onClick={handleOverlayImplement}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Implement
          </button>
          <button className="doc-line-ai-btn" onClick={handleOverlayAskAI}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Ask AI
          </button>
        </div>

        {/* AI suggestion lines */}
        {features.some(f => f.aiLines?.length > 0) && (
          <div className="doc-ai-section">
            {features.map(feat => feat.aiLines?.map((al, ai) => (
              <div key={`${feat.id}-ai-${ai}`} className={`doc-ai-line ${al.status}`}>
                <div className="doc-ai-line-left">
                  <svg className="doc-ai-line-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div className="doc-ai-line-body">
                  <span className="doc-ai-text">{al.text}</span>
                  {al.status === 'suggested' && (
                    <div className="doc-ai-line-actions">
                      <button className="doc-ai-accept" onClick={() => handleAiAction(feat.id, ai, 'accept')}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Accept
                      </button>
                      <button className="doc-ai-dismiss" onClick={() => handleAiAction(feat.id, ai, 'dismiss')}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Dismiss
                      </button>
                    </div>
                  )}
                  {al.status === 'accepted' && (
                    <span className="doc-ai-accepted-badge">Accepted</span>
                  )}
                </div>
              </div>
            )))}
          </div>
        )}
      </div>
    </div>
  )
}
