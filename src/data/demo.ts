import { Stock, Debt, SavingsAccount, FinancialGoal, Trip, BudgetEntry, Bill, Asset } from '../types'

const now = new Date()
const monthStr = (offset = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const demoStocks: Stock[] = [
  {
    id: 'stock-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    shares: 15,
    purchasePrice: 155.40,
    currentPrice: 182.63,
    priceHistory: [148, 152, 149, 155, 158, 162, 160, 165, 170, 168, 175, 178, 182.63],
    addedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'stock-2',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    shares: 8,
    purchasePrice: 310.50,
    currentPrice: 415.22,
    priceHistory: [305, 315, 320, 318, 330, 340, 355, 360, 370, 385, 395, 408, 415.22],
    addedAt: '2024-01-20T00:00:00Z',
  },
  {
    id: 'stock-3',
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    shares: 5,
    purchasePrice: 450.00,
    currentPrice: 875.40,
    priceHistory: [420, 440, 460, 500, 540, 580, 620, 680, 720, 780, 820, 855, 875.40],
    addedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'stock-4',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    shares: 10,
    purchasePrice: 138.20,
    currentPrice: 156.88,
    priceHistory: [132, 135, 138, 140, 142, 145, 148, 150, 152, 154, 155, 157, 156.88],
    addedAt: '2024-02-10T00:00:00Z',
  },
  {
    id: 'stock-5',
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    shares: 12,
    purchasePrice: 242.00,
    currentPrice: 198.50,
    priceHistory: [260, 250, 245, 240, 230, 215, 208, 195, 200, 205, 198, 202, 198.50],
    addedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'stock-6',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    shares: 20,
    purchasePrice: 410.00,
    currentPrice: 485.70,
    priceHistory: [400, 408, 415, 420, 428, 435, 445, 452, 460, 468, 475, 481, 485.70],
    watchlist: false,
    addedAt: '2024-01-05T00:00:00Z',
  },
  {
    id: 'stock-7',
    symbol: 'AMZN',
    name: 'Amazon.com Inc.',
    shares: 0,
    purchasePrice: 0,
    currentPrice: 185.30,
    priceHistory: [160, 165, 170, 172, 175, 178, 180, 182, 183, 184, 185, 184, 185.30],
    watchlist: true,
    addedAt: '2024-03-10T00:00:00Z',
  },
  {
    id: 'stock-8',
    symbol: 'META',
    name: 'Meta Platforms Inc.',
    shares: 0,
    purchasePrice: 0,
    currentPrice: 502.40,
    priceHistory: [420, 435, 450, 460, 470, 478, 485, 490, 495, 498, 500, 501, 502.40],
    watchlist: true,
    addedAt: '2024-03-15T00:00:00Z',
  },
]

export const demoDebts: Debt[] = [
  {
    id: 'debt-1',
    name: 'Chase Sapphire Card',
    type: 'credit_card',
    balance: 4250.00,
    originalBalance: 6800.00,
    interestRate: 24.99,
    minimumPayment: 85,
    addedAt: '2023-06-01T00:00:00Z',
  },
  {
    id: 'debt-2',
    name: 'Student Loan',
    type: 'student_loan',
    balance: 22400.00,
    originalBalance: 35000.00,
    interestRate: 5.05,
    minimumPayment: 280,
    addedAt: '2020-09-01T00:00:00Z',
  },
  {
    id: 'debt-3',
    name: 'Car Loan - Honda Civic',
    type: 'auto',
    balance: 8750.00,
    originalBalance: 24000.00,
    interestRate: 6.9,
    minimumPayment: 380,
    addedAt: '2021-07-15T00:00:00Z',
  },
]

export const demoSavings: SavingsAccount[] = [
  {
    id: 'sav-1',
    name: 'Emergency Fund',
    balance: 8500,
    goalAmount: 15000,
    monthlyContribution: 500,
    interestRate: 4.85,
    category: 'emergency',
    history: [
      { month: monthStr(-12), balance: 3500 },
      { month: monthStr(-11), balance: 4000 },
      { month: monthStr(-10), balance: 4500 },
      { month: monthStr(-9), balance: 5200 },
      { month: monthStr(-8), balance: 5700 },
      { month: monthStr(-7), balance: 6200 },
      { month: monthStr(-6), balance: 6700 },
      { month: monthStr(-5), balance: 7100 },
      { month: monthStr(-4), balance: 7600 },
      { month: monthStr(-3), balance: 7900 },
      { month: monthStr(-2), balance: 8200 },
      { month: monthStr(-1), balance: 8500 },
    ],
    addedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'sav-2',
    name: 'House Down Payment',
    balance: 32000,
    goalAmount: 80000,
    monthlyContribution: 1200,
    interestRate: 4.5,
    category: 'down_payment',
    history: [
      { month: monthStr(-12), balance: 17600 },
      { month: monthStr(-11), balance: 18800 },
      { month: monthStr(-10), balance: 20000 },
      { month: monthStr(-9), balance: 21200 },
      { month: monthStr(-8), balance: 22400 },
      { month: monthStr(-7), balance: 23600 },
      { month: monthStr(-6), balance: 24800 },
      { month: monthStr(-5), balance: 26000 },
      { month: monthStr(-4), balance: 27200 },
      { month: monthStr(-3), balance: 28400 },
      { month: monthStr(-2), balance: 30200 },
      { month: monthStr(-1), balance: 32000 },
    ],
    addedAt: '2022-03-01T00:00:00Z',
  },
  {
    id: 'sav-3',
    name: 'Vacation Fund',
    balance: 2800,
    goalAmount: 5000,
    monthlyContribution: 200,
    interestRate: 4.0,
    category: 'vacation',
    history: [
      { month: monthStr(-12), balance: 600 },
      { month: monthStr(-11), balance: 800 },
      { month: monthStr(-10), balance: 1000 },
      { month: monthStr(-9), balance: 1200 },
      { month: monthStr(-8), balance: 1400 },
      { month: monthStr(-7), balance: 1600 },
      { month: monthStr(-6), balance: 1800 },
      { month: monthStr(-5), balance: 2000 },
      { month: monthStr(-4), balance: 2200 },
      { month: monthStr(-3), balance: 2400 },
      { month: monthStr(-2), balance: 2600 },
      { month: monthStr(-1), balance: 2800 },
    ],
    addedAt: '2023-06-01T00:00:00Z',
  },
]

export const demoGoals: FinancialGoal[] = [
  {
    id: 'goal-1',
    name: 'Emergency Fund (6 months)',
    targetAmount: 15000,
    currentAmount: 8500,
    targetDate: '2025-12-31',
    priority: 'high',
    category: 'savings',
    color: '#6366f1',
    addedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'goal-2',
    name: 'House Down Payment',
    targetAmount: 80000,
    currentAmount: 32000,
    targetDate: '2027-06-01',
    priority: 'high',
    category: 'savings',
    color: '#0ea5e9',
    addedAt: '2022-03-01T00:00:00Z',
  },
  {
    id: 'goal-3',
    name: 'Pay Off Credit Card',
    targetAmount: 4250,
    currentAmount: 2550,
    targetDate: '2025-06-30',
    priority: 'high',
    category: 'debt_payoff',
    color: '#f43f5e',
    addedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'goal-4',
    name: 'New Laptop',
    targetAmount: 2500,
    currentAmount: 1800,
    targetDate: '2025-04-30',
    priority: 'medium',
    category: 'purchase',
    color: '#10b981',
    addedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'goal-5',
    name: 'Investment Portfolio $50K',
    targetAmount: 50000,
    currentAmount: 31205,
    targetDate: '2026-12-31',
    priority: 'medium',
    category: 'investment',
    color: '#f59e0b',
    addedAt: '2023-01-01T00:00:00Z',
  },
]

export const demoTrips: Trip[] = [
  {
    id: 'trip-1',
    name: 'Japan 2025',
    destination: 'Tokyo & Kyoto, Japan',
    startDate: '2025-10-01',
    endDate: '2025-10-14',
    totalBudget: 5000,
    expenses: [
      { id: 'e-1', category: 'flights', description: 'Round trip flights', budgeted: 1200, actual: 1150 },
      { id: 'e-2', category: 'hotel', description: 'Hotels (14 nights)', budgeted: 1400, actual: 0 },
      { id: 'e-3', category: 'food', description: 'Meals & dining', budgeted: 800, actual: 0 },
      { id: 'e-4', category: 'activities', description: 'Tours & attractions', budgeted: 600, actual: 0 },
      { id: 'e-5', category: 'transport', description: 'JR Pass + local transport', budgeted: 500, actual: 480 },
      { id: 'e-6', category: 'shopping', description: 'Souvenirs & shopping', budgeted: 500, actual: 0 },
    ],
    addedAt: '2024-09-01T00:00:00Z',
  },
  {
    id: 'trip-2',
    name: 'NYC Weekend',
    destination: 'New York City, NY',
    startDate: '2025-04-18',
    endDate: '2025-04-20',
    totalBudget: 1200,
    expenses: [
      { id: 'e-7', category: 'flights', description: 'Round trip flights', budgeted: 300, actual: 285 },
      { id: 'e-8', category: 'hotel', description: 'Hotel (2 nights)', budgeted: 450, actual: 460 },
      { id: 'e-9', category: 'food', description: 'Meals', budgeted: 250, actual: 220 },
      { id: 'e-10', category: 'activities', description: 'Shows & museums', budgeted: 200, actual: 180 },
    ],
    addedAt: '2025-02-15T00:00:00Z',
  },
]

export const demoBudget: BudgetEntry[] = (() => {
  const entries: BudgetEntry[] = []
  const m = now.getMonth() + 1
  const y = now.getFullYear()

  const incomeItems = [
    { category: 'Salary', description: 'Monthly salary', amount: 7500 },
    { category: 'Freelance', description: 'Side projects', amount: 800 },
  ]

  const expenseItems = [
    { category: 'Rent', description: 'Monthly rent', amount: 1800 },
    { category: 'Groceries', description: 'Food & groceries', amount: 420 },
    { category: 'Transport', description: 'Gas & transit', amount: 180 },
    { category: 'Utilities', description: 'Electric, water, internet', amount: 145 },
    { category: 'Subscriptions', description: 'Netflix, Spotify, etc.', amount: 55 },
    { category: 'Dining Out', description: 'Restaurants & takeout', amount: 310 },
    { category: 'Entertainment', description: 'Movies, events', amount: 120 },
    { category: 'Health', description: 'Gym, healthcare', amount: 85 },
    { category: 'Shopping', description: 'Clothing, misc', amount: 230 },
    { category: 'Savings Transfer', description: 'To savings accounts', amount: 1900 },
    { category: 'Debt Payments', description: 'Loan & CC payments', amount: 745 },
  ]

  // Generate for last 6 months
  for (let i = 5; i >= 0; i--) {
    const month = m - i <= 0 ? m - i + 12 : m - i
    const year = m - i <= 0 ? y - 1 : y
    const spread = 0.85 + Math.random() * 0.3

    incomeItems.forEach((item, idx) => {
      entries.push({
        id: `budget-inc-${i}-${idx}`,
        month,
        year,
        category: item.category,
        description: item.description,
        amount: Math.round(item.amount * (0.95 + Math.random() * 0.1)),
        type: 'income',
        addedAt: new Date(year, month - 1, 1).toISOString(),
      })
    })

    expenseItems.forEach((item, idx) => {
      entries.push({
        id: `budget-exp-${i}-${idx}`,
        month,
        year,
        category: item.category,
        description: item.description,
        amount: Math.round(item.amount * spread),
        type: 'expense',
        addedAt: new Date(year, month - 1, 1).toISOString(),
      })
    })
  }

  return entries
})()

export const demoBills: Bill[] = [
  { id: 'bill-1', name: 'Rent', amount: 1800, category: 'housing', dueDay: 1, frequency: 'monthly', autoPay: false, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-2', name: 'Electric & Water', amount: 145, category: 'utilities', dueDay: 15, frequency: 'monthly', autoPay: true, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-3', name: 'Internet', amount: 65, category: 'utilities', dueDay: 20, frequency: 'monthly', autoPay: true, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-4', name: 'Car Insurance', amount: 120, category: 'insurance', dueDay: 5, frequency: 'monthly', autoPay: false, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-5', name: 'Netflix', amount: 22, category: 'subscriptions', dueDay: 12, frequency: 'monthly', autoPay: true, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-6', name: 'Spotify', amount: 11, category: 'subscriptions', dueDay: 8, frequency: 'monthly', autoPay: true, addedAt: '2024-01-01T00:00:00Z' },
  { id: 'bill-7', name: 'Car Loan Payment', amount: 380, category: 'loan', dueDay: 10, frequency: 'monthly', autoPay: true, addedAt: '2024-01-01T00:00:00Z' },
]

export const demoAssets: Asset[] = [
  { id: 'asset-1', name: 'Honda Civic 2021', value: 18500, category: 'vehicle', notes: 'KBB estimated value — update periodically', addedAt: '2024-01-01T00:00:00Z' },
  { id: 'asset-2', name: 'MacBook Pro 14"', value: 1800, category: 'electronics', addedAt: '2024-01-01T00:00:00Z' },
]
