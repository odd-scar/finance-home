/**
 * Stock reordering, cache clearing, and keeping unsynced offline changes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const cloud = vi.hoisted(() => ({
  current: { data: null as unknown, error: null as unknown },
  upsert: vi.fn().mockResolvedValue({ error: null }),
  select: vi.fn(),
}))

vi.mock('../services/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: cloud.upsert,
      select: (...a: unknown[]) => { cloud.select(...a); return { eq: () => ({ maybeSingle: () => Promise.resolve(cloud.current) }) } },
    }),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}))

import { runStartupCacheHygiene, PENDING_SYNC_KEY, STALE_AFTER_MS } from '../services/cacheHygiene'
import {
  state, resetToDemo, addStock, moveStock, removeStock, restoreStock, loadFromSupabase, signOutCleanup,
} from '../store/store'
import type { Stock } from '../types'

// ── Stock order ─────────────────────────────────────────────────────────────

describe('reordering stocks', () => {
  const stock = (id: string, watchlist = false): Stock => ({
    id, symbol: id.toUpperCase(), name: id, shares: watchlist ? 0 : 1, purchasePrice: 1, currentPrice: 1,
    priceHistory: [1], watchlist, addedAt: '',
  })
  beforeEach(() => {
    resetToDemo()
    state.stocks.map(s => s.id).forEach(removeStock)
    ;['a', 'b', 'c'].forEach(id => addStock(stock(id)))
    addStock(stock('w1', true)); addStock(stock('w2', true))
  })
  const order = () => state.stocks.map(s => s.id)

  it('moves within holdings only', () => {
    moveStock('c', -1)
    expect(order()).toEqual(['a', 'c', 'b', 'w1', 'w2'])
    moveStock('a', -1) // already first — no change
    expect(order()).toEqual(['a', 'c', 'b', 'w1', 'w2'])
    moveStock('b', 1)  // last holding can't jump into the watchlist
    expect(order()).toEqual(['a', 'c', 'b', 'w1', 'w2'])
    moveStock('w2', -1)
    expect(order()).toEqual(['a', 'c', 'b', 'w2', 'w1'])
  })

  it('undo puts a removed stock back where it was', () => {
    const b = state.stocks.find(s => s.id === 'b')!
    removeStock('b')
    restoreStock(b, 1)
    expect(order()).toEqual(['a', 'b', 'c', 'w1', 'w2'])
  })
})

// ── Cache clearing ──────────────────────────────────────────────────────────

function memoryStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: k => (m.has(k) ? m.get(k)! : null),
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

describe('automatic cache clearing', () => {
  const NOW = Date.UTC(2026, 9, 18)
  const filled = (extra: Record<string, string> = {}) => memoryStorage({
    'finance-home-data': '{}', 'finance-home-user': 'u', 'finance-home-stock-cache': '{}',
    'finance-home-history-cache': '{}', financeHome_onboarded: '1', ...extra,
  })

  it('clears caches and the local data copy when the app is opened fresh', () => {
    const ls = filled({ 'finance-home-last-active': String(NOW - 60_000) })
    expect(runStartupCacheHygiene(NOW, ls, memoryStorage())).toBe('new-session')
    expect(ls.getItem('finance-home-data')).toBeNull()
    expect(ls.getItem('finance-home-stock-cache')).toBeNull()
    expect(ls.getItem('financeHome_onboarded')).toBe('1') // preferences kept
  })

  it('does nothing on a reload within the same session', () => {
    const ls = filled({ 'finance-home-last-active': String(NOW - 60_000) })
    expect(runStartupCacheHygiene(NOW, ls, memoryStorage({ 'finance-home-session-open': '1' }))).toBe('none')
    expect(ls.getItem('finance-home-data')).toBe('{}')
  })

  it('clears after 3 days without use, even mid-session', () => {
    const ls = filled({ 'finance-home-last-active': String(NOW - STALE_AFTER_MS - 1) })
    expect(runStartupCacheHygiene(NOW, ls, memoryStorage({ 'finance-home-session-open': '1' }))).toBe('stale')
    expect(ls.getItem('finance-home-data')).toBeNull()
  })

  it('never clears data that has not reached the cloud yet', () => {
    const ls = filled({ [PENDING_SYNC_KEY]: '1' })
    runStartupCacheHygiene(NOW, ls, memoryStorage())
    expect(ls.getItem('finance-home-data')).toBe('{}')
    expect(ls.getItem('finance-home-stock-cache')).toBeNull() // temporary caches still go
  })
})

// ── Unsynced offline changes ───────────────────────────────────────────────

describe('changes made offline are uploaded on the next open, not overwritten', () => {
  beforeEach(() => { signOutCleanup(); cloud.upsert.mockClear(); cloud.select.mockClear() })

  it('pushes the local copy instead of pulling the older cloud copy', async () => {
    localStorage.setItem('finance-home-user', 'user-x')
    localStorage.setItem('finance-home-data', '{"goals":[]}')
    localStorage.setItem(PENDING_SYNC_KEY, '1')
    cloud.current = { data: { state: { goals: [] } }, error: null }
    await loadFromSupabase('user-x')
    expect(cloud.select).not.toHaveBeenCalled()
    expect(cloud.upsert).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(localStorage.getItem(PENDING_SYNC_KEY)).toBeNull() // cleared once saved
  })

  it('pulls from the cloud normally when nothing is pending', async () => {
    localStorage.setItem('finance-home-user', 'user-y')
    localStorage.setItem('finance-home-data', '{"goals":[]}')
    cloud.current = { data: { state: { goals: [] } }, error: null }
    await loadFromSupabase('user-y')
    expect(cloud.select).toHaveBeenCalled()
  })
})
