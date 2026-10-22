export function formatCurrency(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function calcPctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / from) * 100
}

// Linear regression for trend prediction
export function linearRegression(data: number[]): { slope: number; predict: (x: number) => number } {
  const n = data.length
  if (n < 2) return { slope: 0, predict: () => data[0] ?? 0 }
  const sumX = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = data.reduce((a, b) => a + b, 0)
  const sumXY = data.reduce((acc, y, i) => acc + i * y, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, predict: (x: number) => intercept + slope * x }
}

// Compound interest projection.
// `rateIsAPY` treats annualRate as an effective annual yield (what banks quote)
// rather than a nominal APR compounded monthly.
export function projectGrowth(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  months: number,
  rateIsAPY = false
): { month: string; balance: number }[] {
  const monthlyRate = rateIsAPY
    ? Math.pow(1 + annualRate / 100, 1 / 12) - 1
    : annualRate / 100 / 12
  const result: { month: string; balance: number }[] = []
  let balance = principal
  const now = new Date()

  for (let i = 0; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ month: label, balance: Math.round(balance) })
    balance = balance * (1 + monthlyRate) + monthlyContribution
  }

  return result
}

// Debt payoff calculator
export function calcDebtPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): {
  months: number
  totalInterest: number
  /** false when the payment never covers the interest (or the 50-year cap is hit) */
  paidOff: boolean
  schedule: { month: number; balance: number; interest: number; principal: number }[]
} {
  if (monthlyPayment <= 0) return { months: 0, totalInterest: 0, paidOff: balance <= 0, schedule: [] }
  const monthlyRate = annualRate / 100 / 12
  let remaining = balance
  let totalInterest = 0
  const schedule = []
  let month = 0

  while (remaining > 0.01 && month < 600) {
    const interest = remaining * monthlyRate
    // Payment doesn't even cover interest — the balance would grow forever
    if (monthlyPayment <= interest) break
    month++
    const principal = Math.min(monthlyPayment - interest, remaining)
    remaining -= principal
    totalInterest += interest
    schedule.push({
      month,
      balance: Math.max(0, remaining),
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
    })
  }

  return {
    months: month,
    totalInterest: Math.round(totalInterest * 100) / 100,
    paidOff: remaining <= 0.01,
    schedule,
  }
}

/**
 * Multi-debt payoff simulation (avalanche / snowball).
 * Each month the total outlay stays fixed at (sum of all minimums + extra):
 * interest accrues, every open debt gets its minimum, and everything left over —
 * the extra plus minimums freed up by debts already paid off — goes to the
 * highest-priority open debt, cascading down the list.
 */
export function simulateDebtPayoff<T extends { id: string; balance: number; interestRate: number; minimumPayment: number }>(
  debts: T[],
  extraPayment: number,
  strategy: 'avalanche' | 'snowball'
): { months: number; totalInterest: number; paidOff: boolean; schedule: { month: number; balance: number }[] } {
  const ordered = (strategy === 'avalanche' ? debtAvalancheOrder(debts) : debtSnowballOrder(debts))
    .filter(d => d.balance > 0)
    .map(d => ({ balance: d.balance, rate: d.interestRate / 100 / 12, min: Math.max(0, d.minimumPayment) }))
  const budget = ordered.reduce((s, d) => s + d.min, 0) + Math.max(0, extraPayment)
  const total = () => ordered.reduce((s, d) => s + d.balance, 0)
  const schedule = [{ month: 0, balance: Math.round(total() * 100) / 100 }]
  let months = 0
  let totalInterest = 0

  while (total() > 0.01 && months < 600) {
    months++
    for (const d of ordered) {
      if (d.balance <= 0) continue
      const interest = d.balance * d.rate
      d.balance += interest
      totalInterest += interest
    }
    let pool = budget
    for (const d of ordered) {
      if (d.balance <= 0) continue
      const pay = Math.min(d.min, d.balance, pool)
      d.balance -= pay
      pool -= pay
    }
    for (const d of ordered) {
      if (pool <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
    }
    schedule.push({ month: months, balance: Math.round(Math.max(0, total()) * 100) / 100 })
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    paidOff: total() <= 0.01,
    schedule,
  }
}

// Avalanche vs Snowball ordering
export function debtAvalancheOrder<T extends { id: string; interestRate: number; balance: number }>(
  debts: T[]
): T[] {
  return [...debts].sort((a, b) => b.interestRate - a.interestRate)
}

export function debtSnowballOrder<T extends { id: string; interestRate: number; balance: number }>(
  debts: T[]
): T[] {
  return [...debts].sort((a, b) => a.balance - b.balance)
}

// Monthly savings needed to reach goal
export function monthlySavingsNeeded(
  targetAmount: number,
  currentAmount: number,
  targetDate: string,
  annualRate = 0
): number {
  if (targetAmount - currentAmount <= 0) return 0
  const months = Math.max(
    1,
    Math.round((parseLocalDate(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375))
  )
  if (annualRate === 0) return (targetAmount - currentAmount) / months
  const r = annualRate / 100 / 12
  const growth = Math.pow(1 + r, months)
  // What you already have also earns interest until the target date
  const shortfall = targetAmount - currentAmount * growth
  if (shortfall <= 0) return 0
  return (shortfall * r) / (growth - 1)
}

/**
 * Parse a date string. Date-only strings ("2026-07-04", what <input type="date"> produces)
 * are treated as local calendar dates — `new Date("2026-07-04")` parses them as UTC
 * midnight, which shows as the previous day anywhere west of UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(dateStr)
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysUntil(dateStr: string): number {
  const target = parseLocalDate(dateStr)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return Math.round((target.getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24))
  }
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Next occurrence of a monthly due day, on or after today. Days past the end of a
 * month clamp to its last day (a "31st" bill is due Feb 28/29, not Mar 3).
 */
export function nextDueDate(dueDay: number, from: Date = new Date()): Date {
  const today = new Date(from)
  today.setHours(0, 0, 0, 0)
  const onDay = (y: number, m: number) => {
    const lastDay = new Date(y, m + 1, 0).getDate()
    return new Date(y, m, Math.min(Math.max(1, dueDay), lastDay))
  }
  const thisMonth = onDay(today.getFullYear(), today.getMonth())
  return thisMonth >= today ? thisMonth : onDay(today.getFullYear(), today.getMonth() + 1)
}

/** Whole days until a monthly bill's next due date (0 = due today). */
export function daysUntilDueDay(dueDay: number, from: Date = new Date()): number {
  const today = new Date(from)
  today.setHours(0, 0, 0, 0)
  return Math.round((nextDueDate(dueDay, from).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function monthLabel(monthNum: number, year: number): string {
  return new Date(year, monthNum - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
