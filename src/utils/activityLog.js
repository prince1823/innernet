// Global append-only activity stream. DoPanel pushes events (tab opens, Claude
// prompts, browser navigations, terminal commands); the Logs mode in Think
// subscribes and renders them as a timeline. Persisted to localStorage so the
// log survives reloads within a session.

import { sampleDoActivityByDate } from '../data/sampleData'

const KEY = 'innernet:activity-log:v2'
const MAX = 2000

let events = load()
const subs = new Set()

// Pre-seed each date that has sample activity, so jumping across days in the
// calendar shows a distinct, thematically-relevant log per day. Real events
// from the Do window still append with today's date.
function seedIfEmpty() {
  const seeded = []
  for (const [date, items] of Object.entries(sampleDoActivityByDate)) {
    if (events.some(e => e.date === date && String(e.id).startsWith('seed-'))) continue
    const [y, mo, d] = date.split('-').map(Number)
    const at = (h, m) => {
      const dt = new Date(y, mo - 1, d, h, m, 0, 0)
      return dt.getTime()
    }
    for (const { h, m, kind, ...rest } of items) {
      const ts = at(h, m)
      seeded.push({
        id: `seed-${date}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        ts,
        date,
        time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        kind,
        ...rest,
      })
    }
  }
  if (seeded.length === 0) return
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
