/**
 * Automatic cache clearing.
 *
 * - The app was closed and opened again (a new browser session), or
 * - nobody has used it for 3 days
 * → clear the temporary caches (quotes, price history, company data) and the
 *   on-device copy of the user's data, so the next load comes fresh from the cloud.
 *   The sign-in session and device preferences (PIN, pay frequency, …) are kept.
 *
 * Safety: the on-device data copy is never cleared while it holds changes that
 * haven't reached the cloud yet (PENDING_SYNC_KEY) — that would lose them.
 */

export const DATA_KEY = 'finance-home-data'
export const LAST_USER_KEY = 'finance-home-user'
/** Set while there are local changes not yet saved to the cloud */
export const PENDING_SYNC_KEY = 'finance-home-pending-sync'

const LAST_ACTIVE_KEY = 'finance-home-last-active'
const SESSION_KEY = 'finance-home-session-open'
export const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000

const TEMP_CACHE_KEYS = [
  'finance-home-stock-cache',
  'finance-home-history-cache',
  'finance-home-fundamentals-cache',
]

export type HygieneResult = 'none' | 'new-session' | 'stale'

function clearCaches(storage: Storage) {
  for (const k of TEMP_CACHE_KEYS) storage.removeItem(k)
  if (!storage.getItem(PENDING_SYNC_KEY)) {
    storage.removeItem(DATA_KEY)
    storage.removeItem(LAST_USER_KEY)
  }
}

/** Run once at startup, before the app loads its data */
export function runStartupCacheHygiene(
  now = Date.now(),
  storage: Storage = localStorage,
  session: Storage = sessionStorage
): HygieneResult {
  let result: HygieneResult = 'none'
  try {
    const last = Number(storage.getItem(LAST_ACTIVE_KEY) || 0)
    if (last && now - last > STALE_AFTER_MS) result = 'stale'
    else if (!session.getItem(SESSION_KEY)) result = 'new-session'

    if (result !== 'none') clearCaches(storage)
    if (result === 'stale') void clearAppFileCaches()

    session.setItem(SESSION_KEY, '1')
    storage.setItem(LAST_ACTIVE_KEY, String(now))
  } catch { /* storage unavailable — nothing to clear */ }
  return result
}

/** The service worker's stored app files (re-downloaded on next load) */
async function clearAppFileCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch { /* not available */ }
}

/**
 * Keep "last active" fresh while the app is used, and handle an app left open in the
 * background: if it comes back after 3+ days, clear and reload with fresh data.
 */
export function trackActivity(): () => void {
  let lastWrite = 0
  const touch = () => {
    const now = Date.now()
    if (now - lastWrite < 60_000) return // at most once a minute
    lastWrite = now
    try { localStorage.setItem(LAST_ACTIVE_KEY, String(now)) } catch { /* ignore */ }
  }
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    try {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0)
      if (last && Date.now() - last > STALE_AFTER_MS) {
        clearCaches(localStorage)
        void clearAppFileCaches().finally(() => window.location.reload())
        return
      }
    } catch { /* ignore */ }
    touch()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pointerdown', touch, { passive: true })
  window.addEventListener('keydown', touch)
  touch()
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pointerdown', touch)
    window.removeEventListener('keydown', touch)
  }
}
