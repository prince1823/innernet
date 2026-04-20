// Global append-only activity stream. DoPanel pushes events (tab opens, Claude
// prompts, browser navigations, terminal commands); the Logs mode in Think
// subscribes and renders them as a timeline. Persisted to localStorage so the
// log survives reloads within a session.

import { sampleDoActivity } from '../data/sampleData'

const KEY = 'innernet:activity-log:v1'
const MAX = 500

let events = load()
const subs = new Set()

// Pre-seed a believable day's activity whenever the log has no events for
// today so Logs mode never renders empty on first paint. Real events from the
// Do window append naturally after seeding.
function seedIfEmpty() {
  const today = todayKey()
  if (events.some(e => e.date === today)) return
  const at = (h, m) => {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }
  const seeded = sampleDoActivity.map(({ h, m, kind, ...rest }) => {
    const ts = at(h, m)
    return {
      id: `seed-${ts}-${Math.random().toString(36).slice(2, 7)}`,
      ts,
      date: today,
      time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      kind,
      ...rest,
    }
  })
  events = [...seeded, ...events].slice(-MAX)
  save()
}

seedIfEmpty()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX))) } catch {}
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function logActivity(kind, detail = {}) {
  const ev = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    date: todayKey(),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    kind,
    ...detail,
  }
  events = [...events, ev].slice(-MAX)
  save()
  subs.forEach(fn => { try { fn(events) } catch {} })
  return ev
}

export function getActivity() { return events }

export function subscribeActivity(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

export function clearActivity() {
  events = []
  save()
  subs.forEach(fn => { try { fn(events) } catch {} })
}
