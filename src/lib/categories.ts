export const INCOME_CATS = ['Salary', 'Freelance', 'Investments', 'Business', 'Other Income']

export const EXPENSE_CATS = [
  'Rent/Mortgage', 'Groceries', 'Gas', 'Transport', 'Utilities', 'Subscriptions',
  'Dining Out', 'Entertainment', 'Health', 'Shopping', 'Savings Transfer',
  'Debt Payments', 'Education', 'Insurance', 'Gifts', 'Other',
]

/** Everyday categories offered first in the Spending log */
export const VARIABLE_CATS = [
  'Groceries', 'Dining Out', 'Gas', 'Shopping', 'Entertainment', 'Transport', 'Health', 'Gifts', 'Other',
]

// Consistent per-category colors used across all views
const CAT_COLORS: Record<string, string> = {
  'Salary': '#10b981', 'Freelance': '#34d399', 'Investments': '#6ee7b7',
  'Business': '#059669', 'Other Income': '#a7f3d0',
  'Rent/Mortgage': '#6366f1', 'Groceries': '#0ea5e9', 'Gas': '#f97316', 'Transport': '#10b981',
  'Utilities': '#f59e0b', 'Subscriptions': '#f43f5e', 'Dining Out': '#a855f7',
  'Entertainment': '#ec4899', 'Health': '#14b8a6', 'Shopping': '#84cc16',
  'Savings Transfer': '#22c55e', 'Debt Payments': '#38bdf8', 'Education': '#4ade80',
  'Insurance': '#e879f9', 'Gifts': '#fbbf24', 'Other': '#6b7280',
}

// Custom categories (e.g. "Starbucks") get a stable color from their name
const CUSTOM_PALETTE = ['#f97316', '#22d3ee', '#c084fc', '#facc15', '#2dd4bf', '#fb7185', '#a3e635', '#818cf8']

export function catColor(cat: string): string {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  let h = 0
  for (const ch of cat) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CUSTOM_PALETTE[h % CUSTOM_PALETTE.length]
}

/** Built-in expense categories followed by the user's own, without duplicates */
export function allExpenseCategories(custom: string[]): string[] {
  const seen = new Set(EXPENSE_CATS.map(c => c.toLowerCase()))
  return [...EXPENSE_CATS, ...custom.filter(c => !seen.has(c.toLowerCase()))]
}

/** Today as "YYYY-MM-DD" in local time */
export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
