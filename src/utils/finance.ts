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

// Compound interest projection
export function projectGrowth(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  months: number
): { month: string; balance: number }[] {
  const monthlyRate = annualRate / 100 / 12
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
): { months: number; totalInterest: number; schedule: { month: number; balance: number; interest: number; principal: number }[] } {
  if (monthlyPayment <= 0) return { months: 0, totalInterest: 0, schedule: [] }
  const monthlyRate = annualRate / 100 / 12
  let remaining = balance
  let totalInterest = 0
  const schedule = []
  let month = 0

  while (remaining > 0.01 && month < 600) {
    month++
    const interest = remaining * monthlyRate
    const principal = Math.min(monthlyPayment - interest, remaining)
    remaining -= principal
    totalInterest += interest
    schedule.push({
      month,
      balance: Math.max(0, remaining),
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
    })
    if (monthlyPayment <= interest) break
  }

  return { months: month, totalInterest: Math.round(totalInterest * 100) / 100, schedule }
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
  const months = Math.max(
    1,
    Math.round((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
  )
  const remaining = targetAmount - currentAmount
  if (annualRate === 0) return remaining / months
  const r = annualRate / 100 / 12
  return (remaining * r) / (Math.pow(1 + r, months) - 1)
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function monthLabel(monthNum: number, year: number): string {
  return new Date(year, monthNum - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
