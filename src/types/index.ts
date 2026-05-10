export type Tab = 'dashboard' | 'stocks' | 'debt' | 'savings' | 'goals' | 'trips' | 'budget' | 'bills' | 'assets' | 'learn'

export interface Stock {
  id: string
  symbol: string
  name: string
  shares: number
  purchasePrice: number
  currentPrice: number
  priceHistory: number[]
  watchlist?: boolean
  addedAt: string
}

export interface Debt {
  id: string
  name: string
  type: 'credit_card' | 'loan' | 'mortgage' | 'student_loan' | 'auto' | 'other'
  balance: number
  originalBalance: number
  interestRate: number
  minimumPayment: number
  addedAt: string
}

export interface SavingsAccount {
  id: string
  name: string
  balance: number
  goalAmount?: number
  monthlyContribution: number
  interestRate: number
  category: 'emergency' | 'down_payment' | 'vacation' | 'retirement' | 'education' | 'general'
  history: { month: string; balance: number; note?: string }[]
  addedAt: string
}

export interface FinancialGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  priority: 'low' | 'medium' | 'high'
  category: 'savings' | 'debt_payoff' | 'investment' | 'purchase' | 'other'
  color: string
  addedAt: string
}

export interface TripExpense {
  id: string
  category: 'flights' | 'hotel' | 'food' | 'activities' | 'transport' | 'shopping' | 'other'
  description: string
  budgeted: number
  actual: number
}

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  totalBudget: number
  expenses: TripExpense[]
  addedAt: string
}

export interface BudgetEntry {
  id: string
  month: number
  year: number
  category: string
  description: string
  amount: number
  type: 'income' | 'expense'
  recurring?: boolean
  /** Marks a one-time override — amount reverts to originalRecurringAmount on next rollover */
  thisMonthOverride?: boolean
  /** The recurring amount to restore after a thisMonthOverride rolls over */
  originalRecurringAmount?: number
  addedAt: string
}

/** Records a period of income at a given amount, enabling change-over-time tracking */
export interface IncomeHistory {
  id: string
  category: string
  description: string
  amount: number
  /** "YYYY-MM" — first month this amount was in effect */
  startDate: string
  /** "YYYY-MM" — last month this amount was in effect; null means currently active */
  endDate: string | null
}

export interface Bill {
  id: string
  name: string
  amount: number
  category: 'housing' | 'utilities' | 'subscriptions' | 'insurance' | 'loan' | 'transportation' | 'other'
  dueDay: number
  frequency: 'monthly' | 'quarterly' | 'annual'
  autoPay: boolean
  notes?: string
  addedAt: string
}

export interface Asset {
  id: string
  name: string
  value: number
  category: 'vehicle' | 'real_estate' | 'electronics' | 'collectibles' | 'other'
  notes?: string
  addedAt: string
}

export interface NetWorthSnapshot {
  month: string
  savings: number
  portfolio: number
  assets: number
  debt: number
  net: number
}

export interface AppState {
  stocks: Stock[]
  debts: Debt[]
  savings: SavingsAccount[]
  goals: FinancialGoal[]
  trips: Trip[]
  budget: BudgetEntry[]
  bills: Bill[]
  assets: Asset[]
  netWorthHistory: NetWorthSnapshot[]
  lastStockUpdate: string | null
  recurringRolledOver: string[]
  incomeHistory: IncomeHistory[]
  /** Monthly spending limits per budget category, e.g. { 'Groceries': 400 } */
  categoryLimits: Record<string, number>
}
