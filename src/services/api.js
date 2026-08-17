// Client for the Worker's /api/* routes — persistent state (notes, calendar)
// and the Google refresh-token exchange. Every request carries a shared
// secret the user enters once per browser (kept in sessionStorage only,
// never in the bundle) so these routes aren't wide open on the internet.

const API_BASE = import.meta.env.VITE_API_BASE || ''
const SECRET_KEY = 'innernet_api_secret'

export function getApiSecret() {
  return sessionStorage.getItem(SECRET_KEY) || ''
}

export function setApiSecret(secret) {
  if (secret) sessionStorage.setItem(SECRET_KEY, secret)
  else sessionStorage.removeItem(SECRET_KEY)
}

export function isUnlocked() {
  return !!getApiSecret()
}

async function apiFetch(path, opts = {}) {
  const secret = getApiSecret()
  if (!secret) throw new Error('locked')
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-App-Secret': secret, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    setApiSecret('')
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `api error ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// Verifies a candidate secret against the server without persisting it first.
export async function verifySecret(secret) {
  const res = await fetch(`${API_BASE}/api/state/notes`, { headers: { 'X-App-Secret': secret } })
  return res.ok
}

export const getState = (key) => apiFetch(`/api/state/${key}`)
export const putState = (key, value) => apiFetch(`/api/state/${key}`, { method: 'PUT', body: JSON.stringify(value) })

export const googleExchange = (code, redirectUri) =>
  apiFetch('/api/google/exchange', { method: 'POST', body: JSON.stringify({ code, redirectUri }) })
export const googleRefresh = () => apiFetch('/api/google/refresh', { method: 'POST' })
export const googleDisconnect = () => apiFetch('/api/google/disconnect', { method: 'POST' })
