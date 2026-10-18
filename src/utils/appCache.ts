import { flushSync, clearLocalDataCache } from '../store/store'
import { HISTORY_CACHE_KEY } from './stockHistory'
import { FUNDAMENTALS_CACHE_KEY } from './fundamentalsClient'

const STOCK_CACHE_KEY = 'finance-home-stock-cache'

/**
 * Clear everything cached on this device and get a clean copy of the app:
 * - saves pending changes to the cloud first
 * - removes the on-device data copy (only if the cloud save was confirmed)
 * - removes the stock quote cache
 * - deletes the service worker's cached app files and unregisters it
 *
 * Kept: the sign-in session and device preferences (PIN, pay frequency, tour/checklist).
 * The caller should reload the page afterwards.
 */
export async function clearAppCache(): Promise<{ dataCleared: boolean }> {
  const synced = await flushSync()
  if (synced) clearLocalDataCache()

  try {
    localStorage.removeItem(STOCK_CACHE_KEY)
    localStorage.removeItem(HISTORY_CACHE_KEY)
    localStorage.removeItem(FUNDAMENTALS_CACHE_KEY)
  } catch { /* storage unavailable */ }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch { /* not available */ }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* not available */ }

  return { dataCleared: synced }
}

/** Save pending changes, then reload into the newest version of the app. */
export async function reloadToLatest(): Promise<void> {
  await flushSync()
  window.location.reload()
}
