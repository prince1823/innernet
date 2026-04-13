import { useState, useRef, useCallback, useEffect } from 'react'
import { featureDocItems } from '../data/sampleData'
import './DocumentPanel.css'

const initialFeatures = featureDocItems.map(f => ({ ...f }))

// SVG icons as inline HTML strings for embedding in contentEditable
const playIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
const starIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`

export default function DocumentPanel({ onAskAI, activeAgentFeatures = [] }) {
  const [features, setFeatures] = useState(initialFeatures)
  const editorRef = useRef(null)

  // Protect inline action buttons from being deleted by backspace/delete
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const keyHandler = (e) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return

      const sel = window.getSelection()
      if (!sel.rangeCount) return

      const range = sel.getRangeAt(0)

      // If selection covers inline actions, prevent deletion
      if (!range.collapsed) {
        const fragment = range.cloneContents()
        if (fragment.querySelector('.doc-inline-actions, .doc-inline-btn')) {
          e.preventDefault()
          return
        }
      }

      // Check if cursor is right next to an inline-actions span
      const node = sel.anchorNode
      if (!node) return

      if (e.key === 'Backspace') {
        // Check if the previous sibling or adjacent node is an inline-actions span
        const prev = node.nodeType === 3
          ? (sel.anchorOffset === 0 ? node.previousSibling : null)
          : node.childNodes[sel.anchorOffset - 1]
        if (prev && (prev.classList?.contains('doc-inline-actions') || prev.closest?.('.doc-inline-actions'))) {
          e.preventDefault()
          return
        }
      }

      if (e.key === 'Delete') {
        // Check if the next sibling or adjacent node is an inline-actions span
        const next = node.nodeType === 3
          ? (sel.anchorOffset === node.length ? node.nextSibling : null)
          : node.childNodes[sel.anchorOffset]
        if (next && (next.classList?.contains('doc-inline-actions') || next.closest?.('.doc-inline-actions'))) {
          e.preventDefault()
          return
        }
      }
    }

    const clickHandler = (e) => {
      const btn = e.target.closest('.doc-inline-btn')
      if (!btn) return
      e.preventDefault()
      e.stopPropagation()

      const featId = btn.dataset.featId
      const action = btn.dataset.action
      const feat = features.find(f => f.id === featId)
      if (!feat) return

      if (action === 'implement' || action === 'ask-ai') {
        const bulletTexts = feat.bullets?.map(b => typeof b === 'string' ? b : b.text).join('\n')
        onAskAI(featId, feat.title, bulletTexts)
      }
    }

    editor.addEventListener('keydown', keyHandler)
    editor.addEventListener('click', clickHandler)
    return () => {
      editor.removeEventListener('keydown', keyHandler)
      editor.removeEventListener('click', clickHandler)
    }
  }, [features, onAskAI])

  // Build initial HTML with inline action icons on each line
  const buildInitialHTML = useCallback(() => {
    let html = ''
    features.forEach((feat, fi) => {
      // Title line — gets both Implement and Ask AI icons
      html += `<h2 class="doc-title" data-feat-id="${feat.id}" data-feat-idx="${fi}">`
      html += feat.title
      html += `<span class="doc-inline-actions" contenteditable="false">`
      html += `<span class="doc-inline-btn doc-inline-implement" data-feat-id="${feat.id}" data-action="implement" title="Implement">${playIcon}</span>`
      html += `<span class="doc-inline-btn doc-inline-ai" data-feat-id="${feat.id}" data-action="ask-ai" title="Ask AI">${starIcon}</span>`
      html += `</span></h2>`

      // Description — gets Ask AI icon
      if (feat.description) {
        html += `<p class="doc-desc" data-feat-id="${feat.id}">`
        html += feat.description
        html += `<span class="doc-inline-actions" contenteditable="false">`
        html += `<span class="doc-inline-btn doc-inline-ai" data-feat-id="${feat.id}" data-action="ask-ai" title="Ask AI">${starIcon}</span>`
        html += `</span></p>`
      }

      // Bullets — each gets Ask AI icon
      feat.bullets.forEach((b, bi) => {
        const bulletText = typeof b === 'string' ? b : b.text
        html += `<p class="doc-bullet" data-feat-id="${feat.id}" data-bullet-idx="${bi}">`
        html += `<span class="doc-bullet-marker" contenteditable="false">&#8226;</span> ${bulletText}`
        html += `<span class="doc-inline-actions" contenteditable="false">`
        html += `<span class="doc-inline-btn doc-inline-ai" data-feat-id="${feat.id}" data-action="ask-ai" title="Ask AI">${starIcon}</span>`
        html += `</span></p>`
      })
    })
    return html
  }, [])

  const [initialHTML] = useState(buildInitialHTML)

  return (
    <div className="doc-panel">

      {/* ── Single contentEditable document ── */}
      <div className="doc-body">
        <div
          ref={editorRef}
          className="doc-editor"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: initialHTML }}
        />
      </div>
    </div>
  )
}
