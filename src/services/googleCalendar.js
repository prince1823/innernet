// Google Calendar integration — real OAuth authorization-code flow. The
// popup goes straight to Google, which redirects to the Worker's
// /oauth/callback with a code; the code is exchanged server-side (via
// api.js) so the refresh token never touches the browser. Access tokens are
// cached client-side (short-lived, low risk) and silently renewed through
// the Worker — no more hourly reconnect popups.

import { googleExchange, googleRefresh, googleDisconnect } from './api'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const API_BASE = import.meta.env.VITE_API_BASE || ''
const SCOPE = 'https://www.googleapis.com/auth/calendar'
const TOKEN_STORAGE_KEY = 'gcal_token'
const GOOGLE_COLOR_INDEX = 2 // blue — matches Google Calendar's default event color
const REDIRECT_URI = `${API_BASE}/oauth/callback`

function getStoredToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.accessToken || !parsed.expiresAt || Date.now() >= parsed.expiresAt) return null
    return parsed
  } catch {
    return null
  }
}

function storeToken(accessToken, expiresInSec) {
  const expiresAt = Date.now() + expiresInSec * 1000 - 60000 // 1 min safety buffer
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken, expiresAt }))
}

export function isGoogleConnected() {
  return sessionStorage.getItem('gcal_connected') === '1' || !!getStoredToken()
}

export async function disconnectGoogleCalendar() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem('gcal_connected')
  await googleDisconnect().catch(() => {})
}

function openAuthPopup() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: window.location.origin,
  })
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  const popup = window.open(url, 'google-oauth', 'width=480,height=640')
  if (!popup) throw new Error('Popup blocked — allow popups for this site to connect Google Calendar')

  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (event.data?.type !== 'google-oauth-result') return
      window.removeEventListener('message', onMessage)
      clearInterval(closedCheck)
      if (event.data.error) { reject(new Error(event.data.error)); return }
      if (!event.data.code) { reject(new Error('No authorization code returned')); return }
      resolve(event.data.code)
    }
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck)
        window.removeEventListener('message', onMessage)
        reject(new Error('Sign-in window was closed'))
      }
    }, 500)
    window.addEventListener('message', onMessage)
  })
}

export async function connectGoogleCalendar() {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')
  const code = await openAuthPopup()
  const { access_token, expires_in } = await googleExchange(code, REDIRECT_URI)
  storeToken(access_token, expires_in)
  sessionStorage.setItem('gcal_connected', '1')
  return access_token
}

async function getValidToken() {
  const stored = getStoredToken()
  if (stored) return stored.accessToken
  // Silent refresh through the Worker — no popup, no user interaction.
  const { access_token, expires_in } = await googleRefresh()
  storeToken(access_token, expires_in)
  sessionStorage.setItem('gcal_connected', '1')
  return access_token
}

function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toLocalTimeStr(date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export async function fetchGoogleEvents(timeMinISO, timeMaxISO) {
  const token = await getValidToken()
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Google Calendar fetch failed (${res.status})`)
  const data = await res.json()
  return data.items || []
}

// Maps Google event objects into the app's event shape, grouped by date
// string (YYYY-MM-DD). All-day events (date-only, no dateTime) are skipped —
// the app's grid is time-slot based and has no all-day lane yet.
export function mapGoogleEventsByDate(items) {
  const byDate = {}
  items.forEach(ev => {
    if (!ev.start?.dateTime || !ev.end?.dateTime) return
    const start = new Date(ev.start.dateTime)
    const end = new Date(ev.end.dateTime)
    const dateStr = toLocalDateStr(start)
    const mapped = {
      id: `gcal-${ev.id}`,
      title: ev.summary || '(No title)',
      time: toLocalTimeStr(start),
      endTime: toLocalTimeStr(end),
      colorIndex: GOOGLE_COLOR_INDEX,
      tags: ['google'],
      attendees: (ev.attendees || []).map(a => a.displayName || a.email).filter(Boolean),
      source: 'google',
      googleEventId: ev.id,
    }
    byDate[dateStr] = [...(byDate[dateStr] || []), mapped]
  })
  return byDate
}

// Pushes an app-created event to the user's real Google Calendar.
export async function createGoogleEvent(dateStr, event) {
  const token = await getValidToken()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = {
    summary: event.title,
    start: { dateTime: `${dateStr}T${event.time}:00`, timeZone },
    end: { dateTime: `${dateStr}T${event.endTime}:00`, timeZone },
  }
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Google Calendar create failed (${res.status})`)
  return res.json()
}
