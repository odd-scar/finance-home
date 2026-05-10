import { AppState, Stock, Debt, SavingsAccount, FinancialGoal, Trip, TripExpense, BudgetEntry, Bill, Asset, NetWorthSnapshot, IncomeHistory } from '../types'
import { v4 as uuid } from 'uuid'
import { demoStocks, demoDebts, demoSavings, demoGoals, demoTrips, demoBudget, demoBills, demoAssets } from '../data/demo'
import { encryptData, decryptData } from '../utils/cryptoStore'
import { supabase } from '../utils/supabase'

const STORAGE_KEY = 'finance-home-data'

// Session encryption key (PIN held in memory only — never persisted here)
let _encKey: string | null = null

// ── Supabase sync ──────────────────────────────────────────────────────────
let _supabaseUserId: string | null = null
let _syncTimer: ReturnType<typeof setTimeout> | null = null

export function setSupabaseUser(userId: string | null) {
  _supabaseUserId = userId
}

/** Debounced — fires 2 s after the last commit to avoid hammering the API */
function scheduleSyncToSupabase() {
  if (!_supabaseUserId) return
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    if (!_supabaseUserId) return
    try {
      await supabase
        .from('user_data')
        .upsert(
          { user_id: _supabaseUserId, state: state, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
    } catch (err) {
      console.warn('Supabase sync failed (offline?):', err)
    }
  }, 2000)
}

/**
 * Called after login. Pulls the user's cloud state and merges it in.
 * If the user is brand-new (no cloud data), their current local state
 * gets pushed up automatically on the next commit.
 */
export async function loadFromSupabase(userId: string): Promise<void> {
  _supabaseUserId = userId

  // Clear any stale local data from a previous user's session before we load
  // cloud data — prevents a brief flash of the wrong person's data.
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* quota */ }

  try {
    // Race against a 10 s timeout so a paused/slow Supabase project never
    // leaves the user stuck on the "Loading your data…" screen forever.
    const fetchPromise = supabase
      .from('user_data')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle()

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('supabase_timeout')), 10_000)
    )

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

    if (!error && data?.state) {
      // Existing user — restore their cloud state exactly as saved.
      // Fall back to empty arrays (never demo data) for any missing keys
      // so old records without a field don't accidentally show demo content.
      const cloud = data.state as Partial<AppState>
      state = {
        stocks:                cloud.stocks                ?? [],
        debts:                 cloud.debts                 ?? [],
        savings:               cloud.savings               ?? [],
        goals:                 cloud.goals                 ?? [],
        trips:                 cloud.trips                 ?? [],
        budget:                cloud.budget                ?? [],
        bills:                 cloud.bills                 ?? [],
        assets:                cloud.assets                ?? [],
        netWorthHistory:       cloud.netWorthHistory       ?? [],
        lastStockUpdate:       cloud.lastStockUpdate       ?? new Date().toISOString(),
        recurringRolledOver:   (cloud as AppState).recurringRolledOver ?? [],
        incomeHistory:         (cloud as AppState).incomeHistory       ?? [],
        categoryLimits:        (cloud as AppState).categoryLimits      ?? {},
      }
      // Persist locally so the app works offline after first load
      const json = JSON.stringify(state)
      try {
        localStorage.setItem(STORAGE_KEY, _encKey ? encryptData(json, _encKey) : json)
      } catch {
        // Storage quota exceeded — data is in memory and Supabase
      }
      listeners.forEach(fn => fn())
    } else {
      // Brand-new user (no cloud record yet) — start with an empty account,
      // NOT demo data. Push the clean state to Supabase immediately.
      state = emptyState()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch { /* quota */ }
      listeners.forEach(fn => fn())
      scheduleSyncToSupabase()
    }
  } catch {
    // Network error — run on whatever state is already in memory
  }
}

export function signOutCleanup() {
  _supabaseUserId = null
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null }
  // Wipe local storage so the next user logging in on this device
  // never briefly sees the previous user's data.
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* quota */ }
  state = emptyState()
  listeners.forEach(fn => fn())
}

export function setStoreEncryptionKey(pin: string | null) {
  _encKey = pin
}

function defaultState(): AppState {
  return {
    stocks: demoStocks,
    debts: demoDebts,
    savings: demoSavings,
    goals: demoGoals,
    trips: demoTrips,
    budget: demoBudget,
    bills: demoBills,
    assets: demoAssets,
    netWorthHistory: [],
    lastStockUpdate: new Date().toISOString(),
    recurringRolledOver: [],
    incomeHistory: [],
    categoryLimits: {},
  }
}

/** Blank slate for brand-new users — no demo data. */
function emptyState(): AppState {
  return {
    stocks: [],
    debts: [],
    savings: [],
    goals: [],
    trips: [],
    budget: [],
    bills: [],
    assets: [],
    netWorthHistory: [],
    lastStockUpdate: new Date().toISOString(),
    recurringRolledOver: [],
    incomeHistory: [],
    categoryLimits: {},
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()

    // Try to decrypt if we have a key, otherwise treat as plaintext
    let jsonStr = raw
    if (_encKey) {
      const decrypted = decryptData(raw, _encKey)
      if (decrypted) {
        jsonStr = decrypted
      } else {
        // Key set but decryption failed — data might be plaintext (first time encrypting)
        // Try parsing as plain JSON; if that works, we'll re-encrypt on next commit
        try { JSON.parse(raw) } catch { return defaultState() }
      }
    }

    const parsed = JSON.parse(jsonStr)
    return {
      stocks: parsed.stocks || demoStocks,
      debts: parsed.debts || demoDebts,
      savings: parsed.savings || demoSavings,
      goals: parsed.goals || demoGoals,
      trips: parsed.trips || demoTrips,
      budget: parsed.budget || demoBudget,
      bills: parsed.bills || demoBills,
      assets: parsed.assets || demoAssets,
      netWorthHistory: parsed.netWorthHistory || [],
      lastStockUpdate: parsed.lastStockUpdate || new Date().toISOString(),
      recurringRolledOver: parsed.recurringRolledOver || [],
      incomeHistory: parsed.incomeHistory || [],
      categoryLimits: parsed.categoryLimits || {},
    }
  } catch {
    return defaultState()
  }
}

export let state: AppState = loadState()
const listeners = new Set<() => void>()

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Re-initialize store after PIN is entered (decrypts data with the new key)
export function reinitializeStore(pin: string | null) {
  _encKey = pin
  state = loadState()
  // Immediately re-save so data is encrypted with the new key
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(STORAGE_KEY, _encKey ? encryptData(json, _encKey) : json)
  } catch (err) {
    console.warn('localStorage save failed during re-initialization:', err)
  }
  listeners.forEach(fn => fn())
}

function commit(updater: (prev: AppState) => AppState) {
  state = updater(state)
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(STORAGE_KEY, _encKey ? encryptData(json, _encKey) : json)
  } catch (err) {
    console.warn('localStorage save failed (quota exceeded?):', err)
    // State is still in memory; Supabase sync will preserve data if logged in
  }
  scheduleSyncToSupabase()
  listeners.forEach(fn => fn())
}

// Stocks
export const addStock = (stock: Stock) => commit(s => ({ ...s, stocks: [...s.stocks, stock] }))
export const updateStock = (id: string, updates: Partial<Stock>) =>
  commit(s => ({ ...s, stocks: s.stocks.map(st => (st.id === id ? { ...st, ...updates } : st)) }))
export const removeStock = (id: string) =>
  commit(s => ({ ...s, stocks: s.stocks.filter(st => st.id !== id) }))
export const refreshStockPrices = (updates: { id: string; currentPrice: number; priceHistory: number[] }[]) =>
  commit(s => ({
    ...s,
    lastStockUpdate: new Date().toISOString(),
    stocks: s.stocks.map(st => {
      const u = updates.find(u => u.id === st.id)
      return u ? { ...st, currentPrice: u.currentPrice, priceHistory: u.priceHistory } : st
    }),
  }))

// Debts
export const addDebt = (debt: Debt) => commit(s => ({ ...s, debts: [...s.debts, debt] }))
export const updateDebt = (id: string, updates: Partial<Debt>) =>
  commit(s => ({ ...s, debts: s.debts.map(d => (d.id === id ? { ...d, ...updates } : d)) }))
export const removeDebt = (id: string) => commit(s => ({ ...s, debts: s.debts.filter(d => d.id !== id) }))

// Helpers
const currentMonthStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const upsertHistory = (history: SavingsAccount['history'], balance: number) => {
  const month = currentMonthStr()
  const idx = history.findIndex(h => h.month === month)
  if (idx >= 0) return history.map((h, i) => (i === idx ? { ...h, balance } : h))
  return [...history, { month, balance }]
}

// Savings
export const addSavings = (account: SavingsAccount) => {
  const seeded = { ...account, history: upsertHistory(account.history, account.balance) }
  commit(s => ({ ...s, savings: [...s.savings, seeded] }))
}
export const updateSavings = (id: string, updates: Partial<SavingsAccount>) =>
  commit(s => ({
    ...s,
    savings: s.savings.map(a => {
      if (a.id !== id) return a
      const merged = { ...a, ...updates }
      // Auto-snapshot this month whenever balance is updated
      if (updates.balance !== undefined) {
        return { ...merged, history: upsertHistory(merged.history, updates.balance) }
      }
      return merged
    }),
  }))
export const removeSavings = (id: string) =>
  commit(s => ({ ...s, savings: s.savings.filter(a => a.id !== id) }))
export const updateSavingsNote = (id: string, month: string, note: string) =>
  commit(s => ({
    ...s,
    savings: s.savings.map(a =>
      a.id !== id ? a : {
        ...a,
        history: a.history.map(h => h.month === month ? { ...h, note } : h),
      }
    ),
  }))

// Goals
export const addGoal = (goal: FinancialGoal) => commit(s => ({ ...s, goals: [...s.goals, goal] }))
export const updateGoal = (id: string, updates: Partial<FinancialGoal>) =>
  commit(s => ({ ...s, goals: s.goals.map(g => (g.id === id ? { ...g, ...updates } : g)) }))
export const removeGoal = (id: string) => commit(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) }))

// Trips
export const addTrip = (trip: Trip) => commit(s => ({ ...s, trips: [...s.trips, trip] }))
export const updateTrip = (id: string, updates: Partial<Trip>) =>
  commit(s => ({ ...s, trips: s.trips.map(t => (t.id === id ? { ...t, ...updates } : t)) }))
export const removeTrip = (id: string) => commit(s => ({ ...s, trips: s.trips.filter(t => t.id !== id) }))
export const addTripExpense = (tripId: string, expense: TripExpense) =>
  commit(s => ({
    ...s,
    trips: s.trips.map(t => (t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t)),
  }))
export const updateTripExpense = (tripId: string, expId: string, updates: Partial<TripExpense>) =>
  commit(s => ({
    ...s,
    trips: s.trips.map(t =>
      t.id === tripId
        ? { ...t, expenses: t.expenses.map(e => (e.id === expId ? { ...e, ...updates } : e)) }
        : t
    ),
  }))
export const removeTripExpense = (tripId: string, expId: string) =>
  commit(s => ({
    ...s,
    trips: s.trips.map(t =>
      t.id === tripId ? { ...t, expenses: t.expenses.filter(e => e.id !== expId) } : t
    ),
  }))

// Budget
export const addBudgetEntry = (entry: BudgetEntry) =>
  commit(s => ({ ...s, budget: [...s.budget, entry] }))
export const updateBudgetEntry = (id: string, updates: Partial<BudgetEntry>) =>
  commit(s => ({ ...s, budget: s.budget.map(b => (b.id === id ? { ...b, ...updates } : b)) }))
export const removeBudgetEntry = (id: string) =>
  commit(s => ({ ...s, budget: s.budget.filter(b => b.id !== id) }))

/**
 * Roll over recurring budget entries from the previous month into `month/year`.
 * Only runs once per month (tracked in recurringRolledOver). Safe to call multiple times.
 * Entries marked thisMonthOverride are rolled over using their originalRecurringAmount
 * so the temporary change reverts automatically the next month.
 */
export function rolloverRecurringEntries(month: number, year: number) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  if (state.recurringRolledOver.includes(monthKey)) return

  let prevMonth = month - 1, prevYear = year
  if (prevMonth < 1) { prevMonth = 12; prevYear-- }

  const recurringFromPrev = state.budget.filter(
    b => b.month === prevMonth && b.year === prevYear && b.recurring
  )

  const targetEntries = state.budget.filter(b => b.month === month && b.year === year)

  const newEntries = recurringFromPrev
    .filter(r => !targetEntries.some(
      t => t.category === r.category && t.description === r.description && t.type === r.type
    ))
    .map(r => {
      // If last month had a one-time override, restore the original recurring amount
      const amount = r.thisMonthOverride && r.originalRecurringAmount !== undefined
        ? r.originalRecurringAmount
        : r.amount
      const { thisMonthOverride: _a, originalRecurringAmount: _b, ...rest } = r
      return {
        ...rest,
        id: uuid(),
        month,
        year,
        amount,
        addedAt: new Date().toISOString(),
      }
    })

  commit(s => ({
    ...s,
    budget: [...s.budget, ...newEntries],
    recurringRolledOver: [...s.recurringRolledOver, monthKey],
  }))
}

/**
 * Update a recurring income entry for this month only.
 * The original amount is stored so the next rollover restores it automatically.
 */
export function updateBudgetEntryThisMonth(id: string, updates: Partial<BudgetEntry>) {
  const entry = state.budget.find(b => b.id === id)
  if (!entry) return
  commit(s => ({
    ...s,
    budget: s.budget.map(b =>
      b.id === id
        ? {
            ...b,
            ...updates,
            thisMonthOverride: true,
            // Preserve the original recurring amount so rollover can restore it
            originalRecurringAmount: b.originalRecurringAmount ?? b.amount,
          }
        : b
    ),
  }))
}

/**
 * Update a recurring income entry from this month onward.
 * All existing future entries in the same recurring series are updated.
 * A history record is created logging the old amount with its end date.
 */
export function updateBudgetEntryGoingForward(
  id: string,
  updates: Partial<BudgetEntry>,
  viewMonth: number,
  viewYear: number
) {
  const entry = state.budget.find(b => b.id === id)
  if (!entry) return

  const oldAmount = entry.amount
  const newAmount = updates.amount ?? oldAmount
  const newCategory = updates.category ?? entry.category
  const newDescription = updates.description ?? entry.description

  const currentMonthKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`
  const prevMonthNum = viewMonth === 1 ? 12 : viewMonth - 1
  const prevYearNum  = viewMonth === 1 ? viewYear - 1 : viewYear
  const prevMonthKey = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`

  let historyUpdates = [...state.incomeHistory]

  if (oldAmount !== newAmount) {
    // Close any open history record for this income source
    const openRecord = state.incomeHistory.find(
      h => h.category === entry.category &&
           h.description === entry.description &&
           h.endDate === null
    )

    if (openRecord) {
      historyUpdates = historyUpdates.map(h =>
        h.id === openRecord.id ? { ...h, endDate: prevMonthKey } : h
      )
    } else {
      // First time tracking history — backfill a past record from the earliest budget entry
      const earliest = [...state.budget]
        .filter(b =>
          b.category === entry.category &&
          b.description === entry.description &&
          b.type === entry.type &&
          b.recurring
        )
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)[0]

      const startDate = earliest
        ? `${earliest.year}-${String(earliest.month).padStart(2, '0')}`
        : currentMonthKey

      if (startDate < currentMonthKey) {
        historyUpdates.push({
          id: uuid(),
          category: entry.category,
          description: entry.description,
          amount: oldAmount,
          startDate,
          endDate: prevMonthKey,
        })
      }
    }

    // Open a new current record with the updated amount
    historyUpdates.push({
      id: uuid(),
      category: newCategory,
      description: newDescription,
      amount: newAmount,
      startDate: currentMonthKey,
      endDate: null,
    })
  }

  commit(s => ({
    ...s,
    incomeHistory: historyUpdates,
    budget: s.budget.map(b => {
      // Update the edited entry
      if (b.id === id) {
        return { ...b, ...updates, thisMonthOverride: false, originalRecurringAmount: undefined }
      }
      // Also update all future entries in the same recurring series
      const isFutureMatch =
        b.category === entry.category &&
        b.description === entry.description &&
        b.type === entry.type &&
        b.recurring &&
        (b.year > viewYear || (b.year === viewYear && b.month > viewMonth))
      if (isFutureMatch) {
        return { ...b, ...updates }
      }
      return b
    }),
  }))
}

// Bills
export const addBill = (bill: Bill) => commit(s => ({ ...s, bills: [...s.bills, bill] }))
export const updateBill = (id: string, updates: Partial<Bill>) =>
  commit(s => ({ ...s, bills: s.bills.map(b => b.id === id ? { ...b, ...updates } : b) }))
export const removeBill = (id: string) => commit(s => ({ ...s, bills: s.bills.filter(b => b.id !== id) }))

// Assets
export const addAsset = (asset: Asset) => commit(s => ({ ...s, assets: [...s.assets, asset] }))
export const updateAsset = (id: string, updates: Partial<Asset>) =>
  commit(s => ({ ...s, assets: s.assets.map(a => a.id === id ? { ...a, ...updates } : a) }))
export const removeAsset = (id: string) => commit(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) }))

// Net Worth History — upsert current month
export const snapshotNetWorth = (snapshot: NetWorthSnapshot) =>
  commit(s => {
    const filtered = s.netWorthHistory.filter(h => h.month !== snapshot.month)
    return { ...s, netWorthHistory: [...filtered, snapshot].sort((a, b) => a.month.localeCompare(b.month)) }
  })

// Category Limits
export const setCategoryLimit = (category: string, amount: number) =>
  commit(s => ({ ...s, categoryLimits: { ...s.categoryLimits, [category]: amount } }))

export const removeCategoryLimit = (category: string) =>
  commit(s => {
    const limits = { ...s.categoryLimits }
    delete limits[category]
    return { ...s, categoryLimits: limits }
  })

/**
 * Silently snapshots net worth for the current month if one doesn't already exist.
 * Called automatically on login so the history chart fills in without user action.
 */
export function autoSnapshotIfNeeded() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (state.netWorthHistory.some(h => h.month === month)) return
  // Only auto-snapshot if the user has at least some real data
  const hasData = state.savings.length > 0 || state.debts.length > 0 ||
    state.assets.length > 0 || state.stocks.some(s => !s.watchlist && s.shares > 0)
  if (!hasData) return
  const savTotal  = state.savings.reduce((s, a) => s + a.balance, 0)
  const portValue = state.stocks
    .filter(s => !s.watchlist && s.shares > 0)
    .reduce((s, st) => s + st.shares * st.currentPrice, 0)
  const assTotal  = state.assets.reduce((s, a) => s + a.value, 0)
  const debtTotal = state.debts.reduce((s, d) => s + d.balance, 0)
  snapshotNetWorth({
    month,
    savings:   savTotal,
    portfolio: portValue,
    assets:    assTotal,
    debt:      debtTotal,
    net:       savTotal + portValue + assTotal - debtTotal,
  })
}

// Reset
export const resetToDemo = () =>
  commit(() => ({
    stocks: demoStocks,
    debts: demoDebts,
    savings: demoSavings,
    goals: demoGoals,
    trips: demoTrips,
    budget: demoBudget,
    bills: demoBills,
    assets: demoAssets,
    netWorthHistory: [],
    lastStockUpdate: new Date().toISOString(),
    recurringRolledOver: [],
    incomeHistory: [],
    categoryLimits: {},
  }))
