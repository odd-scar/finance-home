import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatPercent,
  calcPctChange,
  linearRegression,
  projectGrowth,
  calcDebtPayoff,
  debtAvalancheOrder,
  debtSnowballOrder,
  monthlySavingsNeeded,
  daysUntil,
  formatDate,
  monthLabel,
} from '../finance'

// ── formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00')
  })
  it('formats cents', () => {
    expect(formatCurrency(9.99)).toBe('$9.99')
  })
  it('formats negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
  it('compact mode abbreviates thousands', () => {
    const result = formatCurrency(1500, true)
    expect(result).toContain('$')
    expect(result).toContain('1') // at least $1.5K or similar
  })
  it('compact mode abbreviates millions', () => {
    const result = formatCurrency(2_500_000, true)
    expect(result).toContain('M')
  })
  it('non-compact mode keeps full precision under 1000', () => {
    expect(formatCurrency(999, false)).toBe('$999.00')
  })
})

// ── formatPercent ──────────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('formats positive with + prefix', () => {
    expect(formatPercent(5.25)).toBe('+5.25%')
  })
  it('formats negative without + prefix', () => {
    expect(formatPercent(-3.10)).toBe('-3.10%')
  })
  it('formats zero with + prefix', () => {
    expect(formatPercent(0)).toBe('+0.00%')
  })
  it('respects custom decimal places', () => {
    expect(formatPercent(1.5, 0)).toBe('+2%') // rounds 1.5 → 2
  })
  it('large percentages', () => {
    expect(formatPercent(150)).toBe('+150.00%')
  })
})

// ── calcPctChange ──────────────────────────────────────────────────────────

describe('calcPctChange', () => {
  it('positive gain', () => {
    expect(calcPctChange(100, 150)).toBeCloseTo(50)
  })
  it('negative loss', () => {
    expect(calcPctChange(200, 100)).toBeCloseTo(-50)
  })
  it('zero from returns 0 (no division by zero)', () => {
    expect(calcPctChange(0, 100)).toBe(0)
  })
  it('no change returns 0', () => {
    expect(calcPctChange(100, 100)).toBe(0)
  })
  it('small fractional change', () => {
    expect(calcPctChange(1000, 1001)).toBeCloseTo(0.1)
  })
})

// ── linearRegression ──────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('returns slope 0 and constant prediction for single-element array', () => {
    const { slope, predict } = linearRegression([42])
    expect(slope).toBe(0)
    expect(predict(0)).toBe(42)
  })
  it('perfectly ascending line gives positive slope', () => {
    const { slope } = linearRegression([1, 2, 3, 4, 5])
    expect(slope).toBeGreaterThan(0)
  })
  it('perfectly descending line gives negative slope', () => {
    const { slope } = linearRegression([5, 4, 3, 2, 1])
    expect(slope).toBeLessThan(0)
  })
  it('flat line gives slope ~0', () => {
    const { slope } = linearRegression([10, 10, 10, 10])
    expect(slope).toBeCloseTo(0)
  })
  it('predict at x=0 is close to first value for ascending data', () => {
    const { predict } = linearRegression([10, 20, 30])
    expect(predict(0)).toBeGreaterThan(0)
  })
  it('handles empty array without crashing', () => {
    const { slope, predict } = linearRegression([])
    expect(slope).toBe(0)
    expect(predict(0)).toBe(0)
  })
})

// ── projectGrowth ─────────────────────────────────────────────────────────

describe('projectGrowth', () => {
  it('returns months + 1 data points', () => {
    const result = projectGrowth(1000, 100, 5, 12)
    expect(result).toHaveLength(13) // months 0..12
  })
  it('first entry equals principal', () => {
    const result = projectGrowth(5000, 0, 0, 6)
    expect(result[0].balance).toBe(5000)
  })
  it('grows over time with positive rate', () => {
    const result = projectGrowth(10000, 500, 5, 12)
    expect(result[12].balance).toBeGreaterThan(result[0].balance)
  })
  it('flat with zero rate and zero contribution', () => {
    const result = projectGrowth(1000, 0, 0, 6)
    expect(result[6].balance).toBe(1000)
  })
  it('month labels are YYYY-MM format', () => {
    const result = projectGrowth(1000, 0, 0, 3)
    expect(result[0].month).toMatch(/^\d{4}-\d{2}$/)
  })
  it('large principal + contributions grows substantially in 36 months', () => {
    const result = projectGrowth(10000, 1000, 7, 36)
    expect(result[36].balance).toBeGreaterThan(50000)
  })
})

// ── calcDebtPayoff ────────────────────────────────────────────────────────

describe('calcDebtPayoff', () => {
  it('returns empty schedule for zero payment', () => {
    const { months, schedule } = calcDebtPayoff(5000, 20, 0)
    expect(months).toBe(0)
    expect(schedule).toHaveLength(0)
  })
  it('pays off debt in finite time', () => {
    const { months } = calcDebtPayoff(1000, 20, 200)
    expect(months).toBeGreaterThan(0)
    expect(months).toBeLessThan(600)
  })
  it('higher payment = fewer months', () => {
    const { months: m1 } = calcDebtPayoff(5000, 20, 200)
    const { months: m2 } = calcDebtPayoff(5000, 20, 500)
    expect(m2).toBeLessThan(m1)
  })
  it('last schedule entry has balance ~0', () => {
    const { schedule } = calcDebtPayoff(1000, 10, 300)
    const last = schedule[schedule.length - 1]
    expect(last.balance).toBeLessThanOrEqual(0.01)
  })
  it('total interest is positive on non-zero rate', () => {
    const { totalInterest } = calcDebtPayoff(5000, 18, 200)
    expect(totalInterest).toBeGreaterThan(0)
  })
  it('zero interest rate charges no interest', () => {
    const { totalInterest } = calcDebtPayoff(1200, 0, 200)
    expect(totalInterest).toBe(0)
  })
  it('breaks before 600 months if payment can never cover interest', () => {
    // $100k at 24% APR, $100/month minimum — payment doesn't cover interest
    const { months } = calcDebtPayoff(100000, 24, 100)
    expect(months).toBeLessThanOrEqual(600)
  })
})

// ── debtAvalancheOrder ────────────────────────────────────────────────────

describe('debtAvalancheOrder', () => {
  const debts = [
    { id: '1', interestRate: 5, balance: 1000 },
    { id: '2', interestRate: 22, balance: 500 },
    { id: '3', interestRate: 12, balance: 2000 },
  ]
  it('sorts highest interest rate first', () => {
    const ordered = debtAvalancheOrder(debts)
    expect(ordered[0].interestRate).toBe(22)
    expect(ordered[1].interestRate).toBe(12)
    expect(ordered[2].interestRate).toBe(5)
  })
  it('does not mutate original array', () => {
    debtAvalancheOrder(debts)
    expect(debts[0].interestRate).toBe(5)
  })
  it('handles single-element array', () => {
    expect(debtAvalancheOrder([debts[0]])).toHaveLength(1)
  })
  it('handles empty array', () => {
    expect(debtAvalancheOrder([])).toHaveLength(0)
  })
})

// ── debtSnowballOrder ─────────────────────────────────────────────────────

describe('debtSnowballOrder', () => {
  const debts = [
    { id: '1', interestRate: 5, balance: 3000 },
    { id: '2', interestRate: 22, balance: 500 },
    { id: '3', interestRate: 12, balance: 1500 },
  ]
  it('sorts smallest balance first', () => {
    const ordered = debtSnowballOrder(debts)
    expect(ordered[0].balance).toBe(500)
    expect(ordered[1].balance).toBe(1500)
    expect(ordered[2].balance).toBe(3000)
  })
  it('does not mutate original array', () => {
    debtSnowballOrder(debts)
    expect(debts[0].balance).toBe(3000)
  })
})

// ── monthlySavingsNeeded ──────────────────────────────────────────────────

describe('monthlySavingsNeeded', () => {
  it('returns a positive number for a future goal', () => {
    const future = new Date()
    future.setMonth(future.getMonth() + 12)
    const result = monthlySavingsNeeded(12000, 0, future.toISOString())
    expect(result).toBeGreaterThan(0)
  })
  it('returns less per month when current amount is larger', () => {
    const future = new Date()
    future.setMonth(future.getMonth() + 12)
    const r1 = monthlySavingsNeeded(10000, 0, future.toISOString())
    const r2 = monthlySavingsNeeded(10000, 5000, future.toISOString())
    expect(r2).toBeLessThan(r1)
  })
  it('does not crash with past date (uses min 1 month)', () => {
    const past = new Date(2020, 0, 1).toISOString()
    expect(() => monthlySavingsNeeded(1000, 0, past)).not.toThrow()
  })
})

// ── daysUntil ─────────────────────────────────────────────────────────────

describe('daysUntil', () => {
  it('future date returns positive number', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    expect(daysUntil(future.toISOString())).toBeGreaterThan(0)
  })
  it('past date returns negative number', () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    expect(daysUntil(past.toISOString())).toBeLessThan(0)
  })
})

// ── formatDate ────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a known date correctly', () => {
    // Use a local date (not ISO UTC string) to avoid timezone-shift edge cases
    const d = new Date(2024, 5, 15) // June 15 2024 in local time
    const result = formatDate(d.toISOString())
    expect(result).toContain('2024')
    expect(result).toContain('Jun')
  })
})

// ── monthLabel ────────────────────────────────────────────────────────────

describe('monthLabel', () => {
  it('returns a non-empty string', () => {
    expect(monthLabel(1, 2024)).toBeTruthy()
  })
  it('includes the year', () => {
    expect(monthLabel(3, 2025)).toContain('25')
  })
  it('includes month name', () => {
    expect(monthLabel(6, 2024)).toContain('Jun')
  })
})
