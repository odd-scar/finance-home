/**
 * Budget fixed-vs-flexible, savings links, stock reordering, cache clearing,
 * and keeping unsynced offline changes.
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

import { monthPlan, zeroBased, SAVINGS_CATEGORY } from '../lib/budgetMath'
import { runStartupCacheHygiene, PENDING_SYNC_KEY, STALE_AFTER_MS } from '../services/cacheHygiene'
import {
  state, resetToDemo, addBudgetEntry, removeBudgetEntry, updateBudgetEntry, addSavings, addGoal,
  addStock, moveStock, removeStock, restoreStock, rolloverRecurringEntries, loadFromSupabase, signOutCleanup,
} from '../store/store'
import type { Bill, BudgetEntry, Stock } from '../types'

const entry = (id: string, extra: Partial<BudgetEntry> = {}): BudgetEntry => ({
  id, month: 3, year: 2026, category: 'Dining Out', description: 'Tacos', amount: 40,
  type: 'expense', addedAt: '2026-03-01T00:00:00Z', ...extra,
})
const bill = (extra: Partial<Bill> = {}): Bill => ({
  id: 'rent', name: 'Rent', amount: 1500, category: 'housing', dueDay: 1,
  frequency: 'monthly', autoPay: true, addedAt: '2026-01-01T00:00:00Z', ...extra,
})

// ── Fixed vs flexible ───────────────────────────────────────────────────────

describe('budget: bills are fixed, plans are for flexible spending', () => {
  const budget = [
    entry('pay', { type: 'income', category: 'Salary', description: 'Pay', amount: 4000, recurring: true }),
    entry('dine'),
    entry('gym', { category: 'Health', description: 'Gym', amount: 50, recurring: true }),
    entry('save', { category: SAVINGS_CATEGORY, description: 'To HYSA', amount: 300, recurring: true }),
  ]
  const p = monthPlan(budget, [bill(), bill({ id: 'elec', name: 'Electric', amount: 90, category: 'utilities' })], { 'Dining Out': 150, Utilities: 120 }, 3, 2026)

  it('keeps bills and recurring costs out of the category rows', () => {
    expect(p.rows.find(r => r.category === 'Rent/Mortgage')).toBeUndefined()
    expect(p.rows.find(r => r.category === 'Health')).toBeUndefined()
    // A plan on a category that only has a bill shows $0 flexible spending, not the bill
    expect(p.rows.find(r => r.category === 'Utilities')).toMatchObject({ spent: 0, planned: 120 })
    expect(p.rows.find(r => r.category === 'Dining Out')).toMatchObject({ spent: 40, remaining: 110 })
  })

  it('totals fixed costs separately (bills + recurring, not savings)', () => {
    expect(p.fixedTotal).toBe(1500 + 90 + 50)
    expect(p.rows.find(r => r.category === SAVINGS_CATEGORY)?.spent).toBe(300)
  })

  it('zero-based counts fixed costs as already assigned', () => {
    // fixed 1640 + Dining 150 (plan) + Utilities 120 (plan) + Savings 300 (actual)
    expect(zeroBased(p).assigned).toBe(2210)
    expect(zeroBased(p).leftToAssign).toBe(1790)
  })
})

// ── Savings links ───────────────────────────────────────────────────────────

describe('logging savings into an account and toward a goal', () => {
  beforeEach(() => {
    resetToDemo()
    addSavings({ id: 'hysa', name: 'HYSA', balance: 1000, monthlyContribution: 0, interestRate: 4, category: 'general', history: [], addedAt: '' })
    addGoal({ id: 'trip', name: 'Japan', targetAmount: 5000, currentAmount: 200, targetDate: '2027-01-01', priority: 'high', category: 'savings', color: '#fff', addedAt: '' })
  })
  const acct = () => state.savings.find(a => a.id === 'hysa')!
  const goal = () => state.goals.find(g => g.id === 'trip')!
  const saving = (extra: Partial<BudgetEntry> = {}) =>
    entry('s1', { category: SAVINGS_CATEGORY, description: 'Savings', amount: 250, savingsAccountId: 'hysa', goalId: 'trip', ...extra })

  it('adds to both, and undo/delete takes it back out', () => {
    addBudgetEntry(saving())
    expect(acct().balance).toBe(1250)
    expect(goal().currentAmount).toBe(450)
    removeBudgetEntry('s1')
    expect(acct().balance).toBe(1000)
    expect(goal().currentAmount).toBe(200)
  })

  it('editing the amount adjusts by the difference', () => {
    addBudgetEntry(saving())
    updateBudgetEntry('s1', { amount: 100 })
    expect(acct().balance).toBe(1100)
    expect(goal().currentAmount).toBe(300)
  })

  it('ordinary expenses never touch accounts or goals', () => {
    addBudgetEntry(entry('d1', { savingsAccountId: 'hysa' })) // not a savings transfer
    expect(acct().balance).toBe(1000)
  })

  it('a recurring savings entry carried into next month does not re-add money', () => {
    addBudgetEntry(saving({ id: 'r1', month: 6, year: 2097, recurring: true }))
    expect(acct().balance).toBe(1250)
    rolloverRecurringEntries(7, 2097)
    const copied = state.budget.find(b => b.month === 7 && b.year === 2097 && b.category === SAVINGS_CATEGORY)!
    expect(copied.savingsAccountId).toBeUndefined()
    expect(acct().balance).toBe(1250)
  })
})

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
