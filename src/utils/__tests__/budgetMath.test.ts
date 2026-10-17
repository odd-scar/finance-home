import { describe, it, expect, beforeEach } from 'vitest'
import { monthTotals, expensesByCategory, billsForMonth, paycheckPlan, payPeriodDays } from '../budgetMath'
import { markUnlocked, isUnlocked, clearUnlocked, setSessionPin, getSessionPin } from '../auth'
import type { Bill, BudgetEntry } from '../../types'

const bill = (id: string, extra: Partial<Bill> = {}): Bill => ({
  id, name: 'Rent', amount: 1500, category: 'housing', dueDay: 1,
  frequency: 'monthly', autoPay: false, addedAt: new Date(2026, 0, 5).toISOString(), ...extra,
})

const entry = (id: string, extra: Partial<BudgetEntry> = {}): BudgetEntry => ({
  id, month: 3, year: 2026, category: 'Groceries', description: 'Groceries',
  amount: 400, type: 'expense', addedAt: new Date().toISOString(), ...extra,
})

describe('monthTotals', () => {
  it('counts bills as expenses alongside budget entries', () => {
    const t = monthTotals(
      [entry('e1'), entry('i1', { type: 'income', category: 'Salary', description: 'Pay', amount: 5000 })],
      [bill('b1')],
      3, 2026
    )
    expect(t.income).toBe(5000)
    expect(t.entryExpenses).toBe(400)
    expect(t.billExpenses).toBe(1500)
    expect(t.expenses).toBe(1900)
  })

  it('does not double count a bill also logged as an expense with the same name', () => {
    const t = monthTotals([entry('e1', { category: 'Rent/Mortgage', description: 'rent ', amount: 1500 })], [bill('b1')], 3, 2026)
    expect(t.expenses).toBe(1500)
    expect(t.billItems).toHaveLength(0)
  })

  it('spreads quarterly and annual bills monthly', () => {
    const t = monthTotals([], [
      bill('q', { name: 'Car insurance', amount: 600, frequency: 'quarterly', category: 'insurance' }),
      bill('a', { name: 'Amazon Prime', amount: 120, frequency: 'annual', category: 'subscriptions' }),
    ], 3, 2026)
    expect(t.billExpenses).toBeCloseTo(210)
  })

  it('does not add a bill to months before it was added', () => {
    expect(billsForMonth([bill('b1')], [], 12, 2025)).toHaveLength(0)
    expect(billsForMonth([bill('b1')], [], 1, 2026)).toHaveLength(1)
  })
})

describe('fixed vs variable split', () => {
  it('bills + recurring entries are fixed; logged one-off purchases are variable', () => {
    const t = monthTotals(
      [
        entry('rec', { recurring: true, category: 'Subscriptions', description: 'Gym', amount: 50 }),
        entry('coffee', { category: 'Starbucks', description: 'Latte', amount: 6.25, date: '2026-03-04' }),
        entry('repair', { category: 'Transport', description: 'Tire', amount: 180 }),
      ],
      [bill('b1')],
      3, 2026
    )
    expect(t.fixedExpenses).toBe(1550)
    expect(t.variableExpenses).toBeCloseTo(186.25)
    expect(t.fixedExpenses + t.variableExpenses).toBeCloseTo(t.expenses)
  })
})

describe('expensesByCategory', () => {
  it('maps bills into budget categories (so spending limits include them)', () => {
    const by = expensesByCategory([entry('e1')], [bill('b1'), bill('u', { name: 'Electric', amount: 90, category: 'utilities' })], 3, 2026)
    expect(by['Rent/Mortgage']).toBe(1500)
    expect(by['Utilities']).toBe(90)
    expect(by['Groceries']).toBe(400)
  })
})

describe('paycheckPlan', () => {
  const from = new Date(2026, 2, 10) // Mar 10, 2026

  it('only includes bills due before the next paycheck', () => {
    const bills = [
      bill('rent', { dueDay: 1 }),                                   // next due Apr 1 (22 days)
      bill('phone', { name: 'Phone', amount: 80, dueDay: 15 }),      // Mar 15 (5 days)
      bill('elec', { name: 'Electric', amount: 90, dueDay: 23 }),    // Mar 23 (13 days)
    ]
    const p = paycheckPlan(bills, [], 'biweekly', from)
    expect(p.periodDays).toBe(14)
    expect(p.billsDue.map(b => b.bill.id)).toEqual(['phone', 'elec'])
    expect(p.billsDueTotal).toBe(170)
    // Monthly pay covers everything
    expect(paycheckPlan(bills, [], 'monthly', from).billsDueTotal).toBe(1670)
  })

  it('prorates irregular bills and recurring everyday spending to the period', () => {
    const p = paycheckPlan(
      [bill('ins', { name: 'Insurance', amount: 1200, frequency: 'annual' })],
      [entry('g', { recurring: true, amount: 609 })],
      'biweekly', from
    )
    const share = 14 / (365.25 / 12)
    expect(p.sinkingFund).toBeCloseTo(100 * share)
    expect(p.everydaySpending).toBeCloseTo(609 * share)
  })

  it('monthly period length follows the calendar', () => {
    expect(payPeriodDays('monthly', new Date(2026, 1, 1))).toBe(28) // Feb
    expect(payPeriodDays('monthly', new Date(2026, 2, 1))).toBe(31) // Mar
  })
})

describe('PIN quick-lock session', () => {
  beforeEach(() => sessionStorage.clear())

  it('tracks unlocked state without storing the PIN', () => {
    expect(isUnlocked()).toBe(false)
    markUnlocked()
    expect(isUnlocked()).toBe(true)
    expect(Object.values({ ...sessionStorage })).not.toContain('1234')
  })

  it('clearUnlocked also wipes a raw PIN left by older builds', () => {
    setSessionPin('1234')
    markUnlocked()
    clearUnlocked()
    expect(isUnlocked()).toBe(false)
    expect(getSessionPin()).toBeNull()
  })
})
