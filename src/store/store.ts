import { AppState, Stock, Debt, SavingsAccount, FinancialGoal, Trip, TripExpense, BudgetEntry, Bill, Asset, NetWorthSnapshot } from '../types'
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
        stocks:          cloud.stocks          ?? [],
        debts:           cloud.debts           ?? [],
        savings:         cloud.savings         ?? [],
        goals:           cloud.goals           ?? [],
        trips:           cloud.trips           ?? [],
        budget:          cloud.budget          ?? [],
        bills:           cloud.bills           ?? [],
        assets:          cloud.assets          ?? [],
        netWorthHistory: cloud.netWorthHistory ?? [],
        lastStockUpdate: cloud.lastStockUpdate ?? new Date().toISOString(),
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
  }))
