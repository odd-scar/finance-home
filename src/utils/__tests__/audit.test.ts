/**
 * Regression tests for the finance-math / data-safety audit fixes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const supabaseResult = vi.hoisted(() => ({
  current: { data: null as unknown, error: null as unknown },
  upsert: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: supabaseResult.upsert,
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(supabaseResult.current) }) }),
    }),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}))

import {
  calcDebtPayoff, simulateDebtPayoff, monthlySavingsNeeded, projectGrowth,
  parseLocalDate, formatDate, daysUntil, nextDueDate, daysUntilDueDay,
} from '../finance'
import {
  state, resetToDemo, addBudgetEntry, rolloverRecurringEntries,
  loadFromSupabase, signOutCleanup, addGoal,
} from '../../store/store'
import type { BudgetEntry } from '../../types'

// ── debt payoff ──────────────────────────────────────────────────────────

describe('calcDebtPayoff', () => {
  it('flags a payment that never covers interest instead of reporting "1 month"', () => {
    const r = calcDebtPayoff(100000, 24, 100) // $2,000/mo interest vs $100 payment
    expect(r.paidOff).toBe(false)
    expect(r.months).toBe(0)
  })
  it('matches the closed-form amortization for a normal loan', () => {
    // $10,000 @ 6% APR, $193.33/mo → standard 60-month loan
    const r = calcDebtPayoff(10000, 6, 193.33)
    expect(r.paidOff).toBe(true)
    expect(r.months).toBe(60)
    expect(r.totalInterest).toBeCloseTo(1599.8, 0)
  })
})

describe('simulateDebtPayoff', () => {
  const debts = [
    { id: 'card', balance: 2000, interestRate: 24, minimumPayment: 60 },
    { id: 'car', balance: 8000, interestRate: 6, minimumPayment: 200 },
  ]

  it('rolls extra + freed minimums to the next debt (pays off much faster than minimums alone)', () => {
    const minsOnly = simulateDebtPayoff(debts, 0, 'avalanche')
    const withExtra = simulateDebtPayoff(debts, 200, 'avalanche')
    expect(withExtra.paidOff).toBe(true)
    // $460/mo total against ~$10k: must finish in roughly two years, not 4+
    expect(withExtra.months).toBeLessThanOrEqual(26)
    expect(withExtra.months).toBeLessThan(minsOnly.months)
    expect(withExtra.totalInterest).toBeLessThan(minsOnly.totalInterest)
  })

  it('avalanche never pays more interest than snowball', () => {
    const av = simulateDebtPayoff(debts, 150, 'avalanche')
    const sb = simulateDebtPayoff(debts, 150, 'snowball')
    expect(av.totalInterest).toBeLessThanOrEqual(sb.totalInterest)
  })

  it('a single debt matches calcDebtPayoff with min + extra', () => {
    const one = [{ id: 'a', balance: 5000, interestRate: 18, minimumPayment: 150 }]
    const sim = simulateDebtPayoff(one, 100, 'avalanche')
    const single = calcDebtPayoff(5000, 18, 250)
    expect(sim.months).toBe(single.months)
    expect(sim.totalInterest).toBeCloseTo(single.totalInterest, 0)
  })

  it('reports not paid off when payments are below interest', () => {
    const r = simulateDebtPayoff([{ id: 'x', balance: 50000, interestRate: 30, minimumPayment: 50 }], 0, 'avalanche')
    expect(r.paidOff).toBe(false)
  })
})

// ── savings / goals ──────────────────────────────────────────────────────

describe('monthlySavingsNeeded', () => {
  const inMonths = (n: number) => {
    const d = new Date()
    d.setMonth(d.getMonth() + n)
    return d.toISOString()
  }
  it('returns 0 (not negative) for a goal already reached', () => {
    expect(monthlySavingsNeeded(1000, 1500, inMonths(6))).toBe(0)
  })
  it('counts growth on the current balance when earning interest', () => {
    // $5,000 already saved earns interest too, so less is needed than the 0% case
    const noRate = monthlySavingsNeeded(10000, 5000, inMonths(24), 0)
    const withRate = monthlySavingsNeeded(10000, 5000, inMonths(24), 5)
    expect(withRate).toBeLessThan(noRate)
    // FV check: 5000·(1+r)^n + pmt·((1+r)^n − 1)/r ≈ 10000
    const r = 0.05 / 12, n = 24, g = Math.pow(1 + r, n)
    expect(5000 * g + withRate * (g - 1) / r).toBeCloseTo(10000, 0)
  })
})

describe('projectGrowth with APY', () => {
  it('a 5% APY grows $10,000 to exactly $10,500 in 12 months', () => {
    expect(projectGrowth(10000, 0, 5, 12, true)[12].balance).toBe(10500)
  })
  it('APR mode compounds monthly (slightly more)', () => {
    expect(projectGrowth(10000, 0, 5, 12)[12].balance).toBe(10512)
  })
})

// ── dates ────────────────────────────────────────────────────────────────

describe('date-only strings are local calendar dates', () => {
  it('parseLocalDate keeps the calendar day', () => {
    const d = parseLocalDate('2026-07-04')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 4])
  })
  it('formatDate does not shift to the previous day', () => {
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026')
  })
  it('daysUntil is 0 for today', () => {
    const t = new Date()
    const s = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    expect(daysUntil(s)).toBe(0)
  })
})

describe('bill due dates', () => {
  it('a bill due today is 0 days away, not next month', () => {
    const from = new Date(2026, 4, 15, 18, 30) // May 15, 6:30pm
    expect(daysUntilDueDay(15, from)).toBe(0)
  })
  it('day 31 clamps to the end of short months', () => {
    const d = nextDueDate(31, new Date(2026, 1, 10)) // Feb 10, 2026
    expect([d.getMonth(), d.getDate()]).toEqual([1, 28])
  })
  it('rolls to next month once the day has passed (and across year end)', () => {
    const d = nextDueDate(5, new Date(2026, 11, 20)) // Dec 20 → Jan 5
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 5])
  })
})

// ── store: recurring rollover ────────────────────────────────────────────

const entry = (id: string, month: number, year: number, extra: Partial<BudgetEntry> = {}): BudgetEntry => ({
  id, month, year, category: 'Salary', description: 'Paycheck', amount: 4000,
  type: 'income', recurring: true, addedAt: new Date().toISOString(), ...extra,
})

describe('rolloverRecurringEntries', () => {
  beforeEach(() => {
    resetToDemo()
    localStorage.clear()
  })

  it('carries recurring entries across a skipped month', () => {
    addBudgetEntry(entry('r1', 1, 2091))
    rolloverRecurringEntries(3, 2091) // February never opened
    const march = state.budget.filter(b => b.month === 3 && b.year === 2091)
    expect(march).toHaveLength(1)
    expect(march[0].amount).toBe(4000)
  })

  it('browsing ahead to a future month still fills it', () => {
    addBudgetEntry(entry('r2', 6, 2092))
    rolloverRecurringEntries(9, 2092)
    expect(state.budget.some(b => b.month === 9 && b.year === 2092)).toBe(true)
  })

  it('a one-time override reverts in the next month', () => {
    addBudgetEntry(entry('r3', 4, 2093, { amount: 5000, thisMonthOverride: true, originalRecurringAmount: 4000 }))
    rolloverRecurringEntries(5, 2093)
    const may = state.budget.find(b => b.month === 5 && b.year === 2093)!
    expect(may.amount).toBe(4000)
    expect(may.thisMonthOverride).toBeUndefined()
  })
})

// ── store: cloud load safety ─────────────────────────────────────────────

describe('loadFromSupabase', () => {
  beforeEach(() => {
    signOutCleanup()
    supabaseResult.upsert.mockClear()
    vi.useFakeTimers()
  })

  it('does not overwrite cloud data with an empty state when the query errors', async () => {
    supabaseResult.current = { data: null, error: { message: 'permission denied' } }
    await loadFromSupabase('user-a')
    addGoal({
      id: 'g', name: 'x', targetAmount: 1, currentAmount: 0, targetDate: '2030-01-01',
      priority: 'low', category: 'other', color: '#fff', addedAt: new Date().toISOString(),
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(supabaseResult.upsert).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('loads the saved cloud state and syncs normally afterwards', async () => {
    supabaseResult.current = { data: { state: { goals: [], debts: [{ id: 'd', name: 'Loan' }] } }, error: null }
    await loadFromSupabase('user-b')
    expect(state.debts).toHaveLength(1)
    expect(state.stocks).toEqual([]) // missing keys → empty, never demo data
    addGoal({
      id: 'g2', name: 'y', targetAmount: 1, currentAmount: 0, targetDate: '2030-01-01',
      priority: 'low', category: 'other', color: '#fff', addedAt: new Date().toISOString(),
    })
    await vi.advanceTimersByTimeAsync(3000)
    expect(supabaseResult.upsert).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
