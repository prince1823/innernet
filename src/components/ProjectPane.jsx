import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { TerminalPane } from './DoPanel'
import './ProjectPane.css'

// FileSystemDirectoryHandle / FileSystemFileHandle can't be JSON-serialized,
// so we keep them alive in a module-level store keyed by tab id. Lost on reload,
// which just means the user re-picks the folder — acceptable for MVP.
const handleStore = new Map()

const IGNORE = new Set(['node_modules', 'dist', '.git', '.next', '.cache', '.DS_Store'])

const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  c: 'c', cpp: 'cpp', cc: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
  md: 'markdown', mdx: 'markdown',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', xml: 'xml', vue: 'html', svelte: 'html',
  php: 'php', swift: 'swift', kt: 'kotlin', dart: 'dart',
}

function getLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return LANG_MAP[ext] || 'plaintext'
}

async function readDir(dirHandle, path) {
  const out = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (IGNORE.has(name) || name.startsWith('.')) continue
    out.push({
      name,
      path: path ? `${path}/${name}` : name,
      kind: handle.kind, // 'file' | 'directory'
      handle,
    })
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return out
}

export default function ProjectPane({ tab, updateTab }) {
  const state = tab.data
  const stored = handleStore.get(tab.id)
  const [rootHandle, setRootHandle] = useState(stored?.rootHandle || null)
  const [rootName, setRootName] = useState(state.rootName || stored?.rootHandle?.name || '')
  const [childrenByPath, setChildrenByPath] = useState(() => stored?.childrenByPath || new Map())
  const [expanded, setExpanded] = useState(() => new Set(state.expanded || []))
  const [openFiles, setOpenFiles] = useState([])
  const [activePath, setActivePath] = useState(null)
  const [error, setError] = useState('')
  const [termOpen, setTermOpen] = useState(false)
  const [termHeight, setTermHeight] = useState(220)
  const [termData, setTermData] = useState({
    lines: [{ kind: 'out', text: "Innernet shell — type 'help' for commands." }],
    history: [],
  })
  const editorRef = useRef(null)
  const saveTimers = useRef(new Map())
  const termDragRef = useRef(null)
  const mainRef = useRef(null)

  const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  // When this pane remounts (tab switch) and we have a stashed root handle,
  // rehydrate the tree from it so the user sees what they had before.
  useEffect(() => {
    if (rootHandle && childrenByPath.size === 0) {
      readDir(rootHandle, '').then(children => {
        const next = new Map()
        next.set('', children)
        setChildrenByPath(next)
        handleStore.set(tab.id, { rootHandle, childrenByPath: next })
      }).catch(e => setError(e.message))
    }
  }, [rootHandle]) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (patch) => {
    updateTab({ data: { ...state, ...patch } })
  }

  const pickFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker()
      const children = await readDir(handle, '')
      const map = new Map()
      map.set('', children)
      setRootHandle(handle)
      setRootName(handle.name)
      setChildrenByPath(map)
      setExpanded(new Set())
      setOpenFiles([])
      setActivePath(null)
      handleStore.set(tab.id, { rootHandle: handle, childrenByPath: map })
      persist({ rootName: handle.name, expanded: [] })
      updateTab({ title: handle.name })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    }
  }

  const toggleDir = async (node) => {
    if (!childrenByPath.has(node.path)) {
      try {
        const children = await readDir(node.handle, node.path)
        setChildrenByPath(prev => {
          const next = new Map(prev)
          next.set(node.path, children)
          const stored = handleStore.get(tab.id)
          if (stored) stored.childrenByPath = next
          return next
        })
      } catch (e) { setError(e.message); return }
    }
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(node.path)) next.delete(node.path); else next.add(node.path)
      persist({ expanded: Array.from(next) })
      return next
    })
  }

  const openFile = async (node) => {
    const existing = openFiles.find(f => f.path === node.path)
    if (existing) { setActivePath(node.path); return }
    try {
      const file = await node.handle.getFile()
      const content = await file.text()
      setOpenFiles(prev => [...prev, {
        path: node.path, name: node.name, content, dirty: false, handle: node.handle,
      }])
      setActivePath(node.path)
    } catch (e) { setError(e.message) }
  }

  const closeFile = (path, e) => {
    e?.stopPropagation()
    setOpenFiles(prev => {
      const idx = prev.findIndex(f => f.path === path)
      const next = prev.filter(f => f.path !== path)
      if (path === activePath) {
        const fallback = next[idx] || next[idx - 1] || next[0]
        setActivePath(fallback?.path || null)
      }
      return next
    })
  }

  const onEditorChange = (value) => {
    const newContent = value ?? ''
    const path = activePath
    const file = openFiles.find(f => f.path === path)
    if (!file) return

    setOpenFiles(prev => prev.map(f => f.path === path
      ? { ...f, content: newContent, dirty: true }
      : f
    ))

    const existing = saveTimers.current.get(path)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(async () => {
      saveTimers.current.delete(path)
      try {
        const writable = await file.handle.createWritable()
        await writable.write(newContent)
        await writable.close()
        setOpenFiles(prev => prev.map(f => f.path === path
          ? { ...f, dirty: false, savedAt: Date.now() }
          : f
        ))
      } catch (e) { setError(e.message) }
    }, 400)
    saveTimers.current.set(path, timer)
  }

  useEffect(() => {
    const timers = saveTimers.current
    return () => { timers.forEach(id => clearTimeout(id)) }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        setTermOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onTermDragStart = (e) => {
    e.preventDefault()
    const rect = mainRef.current.getBoundingClientRect()
    termDragRef.current = { startY: e.clientY, startHeight: termHeight, containerH: rect.height }
    const onMove = (ev) => {
      const d = termDragRef.current
      if (!d) return
      const delta = d.startY - ev.clientY
      const next = Math.max(80, Math.min(d.containerH - 120, d.startHeight + delta))
      setTermHeight(next)
    }
    const onUp = () => {
      termDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const active = openFiles.find(f => f.path === activePath)

  if (!supported) {
    return (
      <div className="proj-unsupported">
        <p>This browser doesn't support the File System Access API.</p>
        <p>Try Chrome, Edge, Arc, or Brave.</p>
      </div>
    )
  }

  if (!rootHandle) {
    return (
      <div className="proj-empty">
        <div className="proj-empty-inner">
          <h3>Open a project folder</h3>
          <p>Browse and edit files from your local filesystem — saves write back to disk.</p>
          <button className="proj-btn primary" onClick={pickFolder}>Open Folder…</button>
        </div>
      </div>
    )
  }

  return (
    <div className="proj-pane">
      {error && (
        <div className="proj-error">
          {error}
          <button onClick={() => setError('')} className="proj-error-close">×</button>
        </div>
      )}
      <div className="proj-sidebar">
        <div className="proj-sidebar-head">
          <span className="proj-root-name" title={rootName}>{rootName}</span>
          <button className="proj-btn-icon" onClick={pickFolder} title="Change folder">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </button>
        </div>
        <div className="proj-tree">
          {(childrenByPath.get('') || []).map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              expanded={expanded}
              childrenByPath={childrenByPath}
              onToggle={toggleDir}
              onOpen={openFile}
              activePath={activePath}
            />
          ))}
        </div>
      </div>
      <div className="proj-main" ref={mainRef}>
        <div className="proj-filetabs">
          {openFiles.map(f => (
            <div
              key={f.path}
              className={`proj-filetab ${f.path === activePath ? 'active' : ''} ${f.dirty ? 'dirty' : ''}`}
              onClick={() => setActivePath(f.path)}
              title={f.path}
            >
              <span className="proj-filetab-name">{f.name}</span>
              <span className="proj-filetab-close" onClick={e => closeFile(f.path, e)} title="Close">
                {f.dirty ? <span className="proj-dirty-dot">●</span> : '×'}
              </span>
            </div>
          ))}
        </div>
        <div className="proj-editor-wrap">
          {active ? (
            <Editor
              height="100%"
              path={active.path}
              language={getLanguage(active.name)}
              value={active.content}
              onChange={onEditorChange}
              onMount={ed => { editorRef.current = ed }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                renderLineHighlight: 'line',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
              theme="vs"
            />
          ) : (
            <div className="proj-placeholder">Select a file from the tree to start editing.</div>
          )}
        </div>
        {termOpen && (
          <>
            <div className="proj-term-divider" onMouseDown={onTermDragStart} />
            <div className="proj-term-wrap" style={{ height: termHeight }}>
              <div className="proj-term-body">
                <TerminalPane
                  tab={{ data: termData }}
                  updateTab={patch => setTermData(patch.data)}
                />
              </div>
            </div>
          </>
        )}
        <div className="proj-statusbar">
          {active ? (
            <>
              <span className="proj-status-path">{active.path}</span>
              <span className="proj-status-right">
                <span className={`proj-status-save ${active.dirty ? 'saving' : 'saved'}`}>
                  {active.dirty ? 'saving…' : 'saved'}
                </span>
                <span>{getLanguage(active.name)}</span>
                <button
                  className="proj-status-term-toggle"
                  onClick={() => setTermOpen(v => !v)}
                  title={termOpen ? 'Hide terminal (⌘`)' : 'Show terminal (⌘`)'}
                >
                  {termOpen ? 'hide terminal' : 'terminal'}
                </button>
              </span>
            </>
          ) : (
            <>
              <span />
              <span className="proj-status-right">
                <button
                  className="proj-status-term-toggle"
                  onClick={() => setTermOpen(v => !v)}
                  title={termOpen ? 'Hide terminal (⌘`)' : 'Show terminal (⌘`)'}
                >
                  {termOpen ? 'hide terminal' : 'terminal'}
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TreeNode({ node, depth, expanded, childrenByPath, onToggle, onOpen, activePath }) {
  const isOpen = expanded.has(node.path)
  if (node.kind === 'directory') {
    const kids = childrenByPath.get(node.path)
    return (
      <>
        <div
          className="proj-tree-row dir"
          style={{ paddingLeft: depth * 12 + 6 }}
          onClick={() => onToggle(node)}
        >
          <span className="proj-tree-caret">{isOpen ? '▾' : '▸'}</span>
          <span className="proj-tree-name">{node.name}</span>
        </div>
        {isOpen && kids && kids.map(c => (
          <TreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            childrenByPath={childrenByPath}
            onToggle={onToggle}
            onOpen={onOpen}
            activePath={activePath}
          />
        ))}
      </>
    )
  }
  return (
    <div
      className={`proj-tree-row file ${node.path === activePath ? 'active' : ''}`}
      style={{ paddingLeft: depth * 12 + 22 }}
      onClick={() => onOpen(node)}
    >
      <span className="proj-tree-name">{node.name}</span>
    </div>
  )
}
