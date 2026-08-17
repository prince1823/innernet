import { useState } from 'react'
import { isUnlocked, setApiSecret, verifySecret } from '../services/api'

// Small corner control that gates cross-device sync behind a shared secret
// entered once per browser (kept in sessionStorage, never in the bundle).
export default function SyncStatus({ unlocked, syncing, onUnlock }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!value.trim()) return
    setChecking(true)
    setError(null)
    const ok = await verifySecret(value.trim())
    setChecking(false)
    if (!ok) {
      setError('Wrong secret')
      return
    }
    setApiSecret(value.trim())
    setValue('')
    setOpen(false)
    onUnlock()
  }

  if (unlocked) {
    return (
      <div className="sync-status-wrap">
        <div className="sync-status synced" title="Cross-device sync is on">
          <span className={`sync-dot ${syncing ? 'pulsing' : ''}`} />
          {syncing ? 'Syncing…' : 'Synced'}
        </div>
      </div>
    )
  }

  return (
    <div className="sync-status-wrap">
      <button className="sync-status locked" onClick={() => setOpen(v => !v)} title="Enter the sync secret to enable cross-device sync">
        <span className="sync-dot" />
        Sync off
      </button>
      {open && (
        <div className="sync-unlock-popover">
          <input
            type="password"
            autoFocus
            placeholder="Sync secret"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
          />
          <button onClick={submit} disabled={checking}>{checking ? '…' : 'Unlock'}</button>
          {error && <span className="sync-unlock-error">{error}</span>}
        </div>
      )}
    </div>
  )
}
