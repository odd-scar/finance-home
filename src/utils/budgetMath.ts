import type { Bill, BudgetEntry } from '../types'
import { daysUntilDueDay } from './finance'

/** Where each bill category lands in the Budget's expense categories */
export const BILL_TO_BUDGET_CATEGORY: Record<Bill['category'], string> = {
  housing: 'Rent/Mortgage',
  utilities: 'Utilities',
  subscriptions: 'Subscriptions',
  insurance: 'Insurance',
  loan: 'Debt Payments',
  transportation: 'Transport',
  other: 'Other',
}

/** Monthly equivalent — quarterly/annual bills are spread evenly (sinking-fund style) */
export function billMonthlyAmount(b: Bill): number {
  if (b.frequency === 'monthly') return b.amount
  if (b.frequency === 'quarterly') return b.amount / 3
  return b.amount / 12
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()
const monthIdx = (month: number, year: number) => year * 12 + (month - 1)

export interface BillItem {
  bill: Bill
  category: string
  amount: number
}

/**
 * Bills that count toward a month's expenses:
 * - active by then (added that month or earlier — no inventing bills in past months), and
 * - not already logged by hand as an expense entry with the same name that month
 *   (so "Rent" entered in Budget *and* in Bills is only counted once).
 */
export function billsForMonth(bills: Bill[], budget: BudgetEntry[], month: number, year: number): BillItem[] {
  const logged = new Set(
    budget
      .filter(b => b.month === month && b.year === year && b.type === 'expense')
      .map(b => norm(b.description))
      .filter(Boolean)
  )
  const target = monthIdx(month, year)
  return bills
    .filter(b => {
      const added = new Date(b.addedAt)
      const active = isNaN(added.getTime()) || monthIdx(added.getMonth() + 1, added.getFullYear()) <= target
      return active && !logged.has(norm(b.name))
    })
    .map(b => ({ bill: b, category: BILL_TO_BUDGET_CATEGORY[b.category] ?? 'Other', amount: billMonthlyAmount(b) }))
}

export interface MonthTotals {
  income: number
  /** Expenses from Budget entries */
  entryExpenses: number
  /** Expenses from the Bills tab not already logged as entries */
  billExpenses: number
  /** entryExpenses + billExpenses */
  expenses: number
  billItems: BillItem[]
}

/** The one definition of a month's income and expenses, shared by every screen */
export function monthTotals(budget: BudgetEntry[], bills: Bill[], month: number, year: number): MonthTotals {
  const entries = budget.filter(b => b.month === month && b.year === year)
  const income = entries.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
  const entryExpenses = entries.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const billItems = billsForMonth(bills, budget, month, year)
  const billExpenses = billItems.reduce((s, i) => s + i.amount, 0)
  return { income, entryExpenses, billExpenses, expenses: entryExpenses + billExpenses, billItems }
}

/** Expense total per budget category for a month, bills included */
export function expensesByCategory(budget: BudgetEntry[], bills: Bill[], month: number, year: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const b of budget) {
    if (b.month === month && b.year === year && b.type === 'expense') {
      out[b.category] = (out[b.category] ?? 0) + b.amount
    }
  }
  for (const i of billsForMonth(bills, budget, month, year)) {
    out[i.category] = (out[i.category] ?? 0) + i.amount
  }
  return out
}

// ── Pay periods ────────────────────────────────────────────────────────────

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

export const PAY_FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
}

/** Days this paycheck has to cover */
export function payPeriodDays(freq: PayFrequency, from: Date = new Date()): number {
  if (freq === 'weekly') return 7
  if (freq === 'biweekly') return 14
  if (freq === 'semimonthly') return 15
  // Monthly: until the same date next month
  const next = new Date(from.getFullYear(), from.getMonth() + 1, from.getDate())
  return Math.round((next.getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86_400_000)
}

const AVG_DAYS_PER_MONTH = 365.25 / 12

export interface PaycheckPlan {
  periodDays: number
  /** Monthly bills whose next due date falls before the next paycheck */
  billsDue: { bill: Bill; daysUntilDue: number }[]
  billsDueTotal: number
  /** Prorated share of quarterly/annual bills to set aside this period */
  sinkingFund: number
  /** Prorated recurring everyday spending from the budget (groceries, gas…) */
  everydaySpending: number
}

/**
 * What a single paycheck needs to cover: bills actually due before the next one,
 * a set-aside for irregular bills, and this period's share of recurring spending.
 */
export function paycheckPlan(
  bills: Bill[],
  budget: BudgetEntry[],
  freq: PayFrequency,
  from: Date = new Date()
): PaycheckPlan {
  const periodDays = payPeriodDays(freq, from)
  const share = periodDays / AVG_DAYS_PER_MONTH

  const billsDue = bills
    .filter(b => b.frequency === 'monthly')
    .map(b => ({ bill: b, daysUntilDue: daysUntilDueDay(b.dueDay, from) }))
    .filter(x => x.daysUntilDue < periodDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  const billsDueTotal = billsDue.reduce((s, x) => s + x.bill.amount, 0)

  const sinkingFund = bills
    .filter(b => b.frequency !== 'monthly')
    .reduce((s, b) => s + billMonthlyAmount(b) * share, 0)

  // Recurring expense entries for this month, minus anything that's really a bill
  const month = from.getMonth() + 1
  const year = from.getFullYear()
  const billNames = new Set(bills.map(b => norm(b.name)))
  const everydayMonthly = budget
    .filter(b => b.month === month && b.year === year && b.type === 'expense' && b.recurring && !billNames.has(norm(b.description)))
    .reduce((s, b) => s + b.amount, 0)

  return {
    periodDays,
    billsDue,
    billsDueTotal,
    sinkingFund,
    everydaySpending: everydayMonthly * share,
  }
}
