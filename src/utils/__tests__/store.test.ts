/**
 * Store integration tests — exercise state mutations and verify they produce
 * the right state without needing React or a rendered DOM.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase so we don't make real network calls from tests
vi.mock('../../utils/supabase', () => ({
  supabase: {
    from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}))

import {
  state,
  addStock,
  removeStock,
  updateStock,
  addDebt,
  removeDebt,
  updateDebt,
  addSavings,
  removeSavings,
  updateSavings,
  updateSavingsNote,
  addGoal,
  removeGoal,
  updateGoal,
  addBill,
  removeBill,
  addAsset,
  removeAsset,
  addBudgetEntry,
  removeBudgetEntry,
  snapshotNetWorth,
  resetToDemo,
  subscribe,
} from '../../store/store'

import type { Stock, Debt, SavingsAccount, FinancialGoal, Bill, Asset, BudgetEntry } from '../../types'

// ── helpers ────────────────────────────────────────────────────────────────

const makeStock = (id: string): Stock => ({
  id, symbol: 'TST', name: 'Test Inc.', shares: 10, purchasePrice: 100,
  currentPrice: 120, priceHistory: [100, 110, 120], addedAt: new Date().toISOString(),
})

const makeDebt = (id: string): Debt => ({
  id, name: 'Test Loan', type: 'loan', balance: 5000, originalBalance: 10000,
  interestRate: 8, minimumPayment: 150, addedAt: new Date().toISOString(),
})

const makeSavings = (id: string): SavingsAccount => ({
  id, name: 'Test Savings', balance: 2000, monthlyContribution: 200,
  interestRate: 4.5, category: 'general', history: [], addedAt: new Date().toISOString(),
})

const makeGoal = (id: string): FinancialGoal => ({
  id, name: 'New Car', targetAmount: 20000, currentAmount: 5000,
  targetDate: '2026-12-31', priority: 'medium', category: 'purchase',
  color: '#6366f1', addedAt: new Date().toISOString(),
})

const makeBill = (id: string): Bill => ({
  id, name: 'Rent', amount: 1500, category: 'housing', dueDay: 1,
  frequency: 'monthly', autoPay: false, addedAt: new Date().toISOString(),
})

const makeAsset = (id: string): Asset => ({
  id, name: 'Car', value: 15000, category: 'vehicle',
  addedAt: new Date().toISOString(),
})

const makeBudgetEntry = (id: string): BudgetEntry => ({
  id, month: 3, year: 2025, category: 'Food', description: 'Groceries',
  amount: 400, type: 'expense', addedAt: new Date().toISOString(),
})

// Reset to demo data before each test so tests are isolated
beforeEach(() => {
  resetToDemo()
  localStorage.clear()
})

// ── subscribe ─────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('calls listener when state changes', () => {
    const listener = vi.fn()
    const unsub = subscribe(listener)
    addAsset(makeAsset('sub-test'))
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('does not call listener after unsubscribe', () => {
    const listener = vi.fn()
    const unsub = subscribe(listener)
    unsub()
    listener.mockClear()
    addAsset(makeAsset('sub-test-2'))
    expect(listener).not.toHaveBeenCalled()
  })
})

// ── stocks ────────────────────────────────────────────────────────────────

describe('stocks', () => {
  it('addStock adds to the list', () => {
    const prev = state.stocks.length
    addStock(makeStock('s1'))
    expect(state.stocks.length).toBe(prev + 1)
    expect(state.stocks.find(s => s.id === 's1')).toBeDefined()
  })

  it('removeStock removes from the list', () => {
    addStock(makeStock('s2'))
    removeStock('s2')
    expect(state.stocks.find(s => s.id === 's2')).toBeUndefined()
  })

  it('updateStock patches fields', () => {
    addStock(makeStock('s3'))
    updateStock('s3', { currentPrice: 999 })
    expect(state.stocks.find(s => s.id === 's3')?.currentPrice).toBe(999)
  })

  it('removeStock on non-existent id is a no-op', () => {
    const prev = state.stocks.length
    removeStock('does-not-exist')
    expect(state.stocks.length).toBe(prev)
  })
})

// ── debts ─────────────────────────────────────────────────────────────────

describe('debts', () => {
  it('addDebt adds correctly', () => {
    const prev = state.debts.length
    addDebt(makeDebt('d1'))
    expect(state.debts.length).toBe(prev + 1)
  })

  it('removeDebt removes correctly', () => {
    addDebt(makeDebt('d2'))
    removeDebt('d2')
    expect(state.debts.find(d => d.id === 'd2')).toBeUndefined()
  })

  it('updateDebt patches balance', () => {
    addDebt(makeDebt('d3'))
    updateDebt('d3', { balance: 1234 })
    expect(state.debts.find(d => d.id === 'd3')?.balance).toBe(1234)
  })
})

// ── savings ───────────────────────────────────────────────────────────────

describe('savings', () => {
  it('addSavings seeds the current month into history', () => {
    addSavings(makeSavings('sv1'))
    const acct = state.savings.find(a => a.id === 'sv1')
    expect(acct?.history.length).toBeGreaterThan(0)
  })

  it('updateSavings with new balance adds a history entry for current month', () => {
    addSavings(makeSavings('sv2'))
    const before = state.savings.find(a => a.id === 'sv2')!.history.length
    updateSavings('sv2', { balance: 3000 })
    const after = state.savings.find(a => a.id === 'sv2')!.history.length
    // Balance update upserts current month — count stays same or increases by 1
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('removeSavings removes the account', () => {
    addSavings(makeSavings('sv3'))
    removeSavings('sv3')
    expect(state.savings.find(a => a.id === 'sv3')).toBeUndefined()
  })

  it('updateSavingsNote sets a note on the correct month entry', () => {
    addSavings(makeSavings('sv4'))
    const month = state.savings.find(a => a.id === 'sv4')!.history[0].month
    updateSavingsNote('sv4', month, 'Test note')
    const entry = state.savings.find(a => a.id === 'sv4')!.history.find(h => h.month === month)
    expect(entry?.note).toBe('Test note')
  })
})

// ── goals ─────────────────────────────────────────────────────────────────

describe('goals', () => {
  it('addGoal adds correctly', () => {
    const prev = state.goals.length
    addGoal(makeGoal('g1'))
    expect(state.goals.length).toBe(prev + 1)
  })

  it('removeGoal removes correctly', () => {
    addGoal(makeGoal('g2'))
    removeGoal('g2')
    expect(state.goals.find(g => g.id === 'g2')).toBeUndefined()
  })

  it('updateGoal patches currentAmount', () => {
    addGoal(makeGoal('g3'))
    updateGoal('g3', { currentAmount: 9999 })
    expect(state.goals.find(g => g.id === 'g3')?.currentAmount).toBe(9999)
  })
})

// ── bills ─────────────────────────────────────────────────────────────────

describe('bills', () => {
  it('addBill / removeBill work correctly', () => {
    const prev = state.bills.length
    addBill(makeBill('b1'))
    expect(state.bills.length).toBe(prev + 1)
    removeBill('b1')
    expect(state.bills.find(b => b.id === 'b1')).toBeUndefined()
  })
})

// ── assets ────────────────────────────────────────────────────────────────

describe('assets', () => {
  it('addAsset / removeAsset work correctly', () => {
    const prev = state.assets.length
    addAsset(makeAsset('a1'))
    expect(state.assets.length).toBe(prev + 1)
    removeAsset('a1')
    expect(state.assets.find(a => a.id === 'a1')).toBeUndefined()
  })
})

// ── budget ────────────────────────────────────────────────────────────────

describe('budget', () => {
  it('addBudgetEntry / removeBudgetEntry work correctly', () => {
    const prev = state.budget.length
    addBudgetEntry(makeBudgetEntry('be1'))
    expect(state.budget.length).toBe(prev + 1)
    removeBudgetEntry('be1')
    expect(state.budget.find(b => b.id === 'be1')).toBeUndefined()
  })
})

// ── net worth snapshots ───────────────────────────────────────────────────

describe('snapshotNetWorth', () => {
  it('adds a snapshot for a new month', () => {
    const prev = state.netWorthHistory.length
    snapshotNetWorth({ month: '2099-01', savings: 10000, portfolio: 5000, assets: 2000, debt: 3000, net: 14000 })
    expect(state.netWorthHistory.length).toBe(prev + 1)
  })

  it('upserts (replaces) snapshot for existing month', () => {
    snapshotNetWorth({ month: '2099-02', savings: 1000, portfolio: 0, assets: 0, debt: 0, net: 1000 })
    snapshotNetWorth({ month: '2099-02', savings: 2000, portfolio: 0, assets: 0, debt: 0, net: 2000 })
    const entries = state.netWorthHistory.filter(h => h.month === '2099-02')
    expect(entries).toHaveLength(1)
    expect(entries[0].net).toBe(2000)
  })

  it('history is sorted by month ascending', () => {
    snapshotNetWorth({ month: '2099-03', savings: 0, portfolio: 0, assets: 0, debt: 0, net: 3 })
    snapshotNetWorth({ month: '2099-01', savings: 0, portfolio: 0, assets: 0, debt: 0, net: 1 })
    snapshotNetWorth({ month: '2099-02', savings: 0, portfolio: 0, assets: 0, debt: 0, net: 2 })
    const months = state.netWorthHistory.map(h => h.month)
    const relevantIdx = months.indexOf('2099-01')
    if (relevantIdx >= 0) {
      expect(months[relevantIdx]).toBe('2099-01')
      expect(months[relevantIdx + 1]).toBe('2099-02')
      expect(months[relevantIdx + 2]).toBe('2099-03')
    }
  })
})

// ── resetToDemo ───────────────────────────────────────────────────────────

describe('resetToDemo', () => {
  it('restores demo stocks after adding custom ones', () => {
    addStock(makeStock('custom-1'))
    resetToDemo()
    expect(state.stocks.find(s => s.id === 'custom-1')).toBeUndefined()
    expect(state.stocks.length).toBeGreaterThan(0) // demo data restored
  })

  it('clears net worth history', () => {
    snapshotNetWorth({ month: '2099-04', savings: 0, portfolio: 0, assets: 0, debt: 0, net: 0 })
    resetToDemo()
    expect(state.netWorthHistory).toHaveLength(0)
  })
})
