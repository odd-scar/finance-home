import { AppState, Stock, Debt, SavingsAccount, FinancialGoal, Trip, TripExpense, BudgetEntry, Bill, Asset, NetWorthSnapshot } from '../types'
import { v4 as uuid } from 'uuid'
import { demoStocks, demoDebts, demoSavings, demoGoals, demoTrips, demoBudget, demoBills, demoAssets } from '../data/demo'
import { encryptData, decryptData } from '../services/cryptoStore'
import { supabase } from '../services/supabase'
import { SAVINGS_CATEGORY } from '../lib/budgetMath'
import { PENDING_SYNC_KEY } from '../services/cacheHygiene'

const STORAGE_KEY = 'finance-home-data'

// Session encryption key (PIN held in memory only — never persisted here)
let _encKey: string | null = null

/**
 * Set when writing to this device's storage fails — almost always because the
 * browser's quota is full. Without this the failure is invisible: the change sits
 * in memory, looks saved, and is gone on reload. The UI reads it to show a banner.
 */
let _saveError: string | null = null

/** Null when the last save to this device worked, otherwise a message to show */
export function getSaveError(): string | null {
  return _saveError
}

// ── Supabase sync ──────────────────────────────────────────────────────────
const LAST_USER_KEY = 'finance-home-user'
let _supabaseUserId: string | null = null
let _syncTimer: ReturnType<typeof setTimeout> | null = null
/** User whose cloud state has been loaded into memory this session */
let _cloudLoadedFor: string | null = null
/**
 * Pushing to the cloud is only allowed once we know what's in memory is really this
 * user's data — otherwise a failed/timed-out load would upload an empty (or demo)
 * state over their saved data on the next commit.
 */
let _syncEnabled = false

export function setSupabaseUser(userId: string | null) {
  _supabaseUserId = userId
  if (!userId) { _syncEnabled = false; _cloudLoadedFor = null }
}

/** Upload the current state. Resolves true only when the cloud confirmed the save. */
async function pushToSupabase(): Promise<boolean> {
  if (!_supabaseUserId || !_syncEnabled) return false
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { user_id: _supabaseUserId, state: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) { console.warn('Supabase sync failed:', error); return false }
    // Everything on this device is now in the cloud
    try { localStorage.removeItem(PENDING_SYNC_KEY) } catch { /* storage unavailable */ }
    return true
  } catch (err) {
    console.warn('Supabase sync failed (offline?):', err)
    return false
  }
}

/** Debounced — fires 2 s after the last commit to avoid hammering the API */
function scheduleSyncToSupabase() {
  if (!_supabaseUserId || !_syncEnabled) return
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    _syncTimer = null
    void pushToSupabase()
  }, 2000)
}

/**
 * Save to the cloud right now (skipping the debounce). Use before reloading or
 * clearing local data. Resolves false if the cloud copy can't be confirmed current.
 */
export async function flushSync(): Promise<boolean> {
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null }
  return pushToSupabase()
}

/** Drop the on-device copy of the data; the next load pulls it fresh from the cloud. */
export function clearLocalDataCache() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LAST_USER_KEY)
  } catch { /* storage unavailable */ }
}

/**
 * Called after login. Pulls the user's cloud state and merges it in.
 * If the user is brand-new (no cloud data), their current local state
 * gets pushed up automatically on the next commit.
 */
export async function loadFromSupabase(userId: string): Promise<void> {
  // Supabase re-fires SIGNED_IN (e.g. when the tab regains focus). Reloading then
  // would replace in-memory edits that haven't synced yet with the older cloud copy.
  if (_cloudLoadedFor === userId) return

  _supabaseUserId = userId
  _syncEnabled = false

  // A local copy is only trusted if it belongs to this same user
  let sameUserCache = false
  try {
    sameUserCache = localStorage.getItem(LAST_USER_KEY) === userId && !!localStorage.getItem(STORAGE_KEY)
  } catch { /* storage unavailable */ }

  // This device has changes that never reached the cloud (e.g. made offline). Pulling
  // the cloud copy now would silently throw them away — upload them instead.
  let pendingLocal = false
  try { pendingLocal = sameUserCache && !!localStorage.getItem(PENDING_SYNC_KEY) } catch { /* storage unavailable */ }
  if (pendingLocal) {
    _cloudLoadedFor = userId
    _syncEnabled = true
    listeners.forEach(fn => fn())
    void flushSync()
    return
  }

  if (!sameUserCache) {
    // Clear any stale local data from a previous user's session before we load
    // cloud data — prevents a brief flash of the wrong person's data.
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* quota */ }
    state = emptyState()
    listeners.forEach(fn => fn())
  }

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

    // A query error (RLS, paused project, network) is NOT "new user" — treating it
    // that way would push an empty state over the user's real cloud data.
    if (error) throw error

    if (data?.state) {
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
        customCategories:      (cloud as AppState).customCategories    ?? [],
        budgetMode:            (cloud as AppState).budgetMode === 'zero' ? 'zero' : 'simple',
        dismissedAlerts:       Array.isArray((cloud as AppState).dismissedAlerts) ? (cloud as AppState).dismissedAlerts : [],
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
      _syncEnabled = true
      scheduleSyncToSupabase()
    }
    try { localStorage.setItem(LAST_USER_KEY, userId) } catch { /* quota */ }
    _cloudLoadedFor = userId
    _syncEnabled = true
  } catch (err) {
    console.warn('Could not load cloud data:', err)
    // Offline / timed out. If we have this user's own cached copy, keep working on it
    // and sync as usual. Otherwise leave sync off for this session so an empty state
    // never overwrites what's saved in the cloud; the next sign-in event retries.
    if (sameUserCache) _syncEnabled = true
  }
}

export function signOutCleanup() {
  _supabaseUserId = null
  _cloudLoadedFor = null
  _syncEnabled = false
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null }
  // Wipe local storage so the next user logging in on this device
  // never briefly sees the previous user's data.
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LAST_USER_KEY)
    localStorage.removeItem(PENDING_SYNC_KEY)
  } catch { /* quota */ }
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
    customCategories: [],
    budgetMode: 'simple',
    dismissedAlerts: [],
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
    customCategories: [],
    budgetMode: 'simple',
    dismissedAlerts: [],
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
    // Saved data exists — never mix demo records into a real user's data
    // (a key missing from an older save just means "none yet").
    return {
      stocks: parsed.stocks || [],
      debts: parsed.debts || [],
      savings: parsed.savings || [],
      goals: parsed.goals || [],
      trips: parsed.trips || [],
      budget: parsed.budget || [],
      bills: parsed.bills || [],
      assets: parsed.assets || [],
      netWorthHistory: parsed.netWorthHistory || [],
      lastStockUpdate: parsed.lastStockUpdate || new Date().toISOString(),
      recurringRolledOver: parsed.recurringRolledOver || [],
      incomeHistory: parsed.incomeHistory || [],
      categoryLimits: parsed.categoryLimits || {},
      customCategories: parsed.customCategories || [],
      budgetMode: parsed.budgetMode === 'zero' ? 'zero' : 'simple',
      dismissedAlerts: Array.isArray(parsed.dismissedAlerts) ? parsed.dismissedAlerts : [],
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
    _saveError = null
  } catch (err) {
    console.warn('localStorage save failed (quota exceeded?):', err)
    // State is still in memory and Supabase sync will preserve it if signed in, but
    // this device can't hold it — say so instead of letting the change vanish quietly.
    _saveError = _supabaseUserId
      ? "This device is out of storage, so changes are only being saved to the cloud. Use “Clear cache & reload” in your account menu."
      : "This device is out of storage and your changes can't be saved. Sign in to save to the cloud, or free up space."
  }
  // Mark that this device holds changes the cloud doesn't have yet (cleared once saved).
  // Only for a loaded, signed-in account — never for an empty/failed-load state.
  if (_supabaseUserId && _syncEnabled) {
    try { localStorage.setItem(PENDING_SYNC_KEY, '1') } catch { /* storage unavailable */ }
  }
  scheduleSyncToSupabase()
  listeners.forEach(fn => fn())
}

// Stocks
export const addStock = (stock: Stock) => commit(s => ({ ...s, stocks: [...s.stocks, stock] }))
export const updateStock = (id: string, updates: Partial<Stock>) =>
  commit(s => ({ ...s, stocks: s.stocks.map(st => (st.id === id ? { ...st, ...updates } : st)) }))
/**
 * Drag-and-drop: move a stock into another stock's spot, shifting the ones in between.
 * Holdings and watchlist are ordered separately, so a holding never jumps into the
 * watchlist's order.
 */
export const moveStock = (id: string, targetId: string) =>
  commit(s => {
    const stock = s.stocks.find(st => st.id === id)
    const target = s.stocks.find(st => st.id === targetId)
    if (!stock || !target || stock === target || !!stock.watchlist !== !!target.watchlist) return s
    const isWatch = !!stock.watchlist
    const list = s.stocks.filter(st => !!st.watchlist === isWatch)
    const reordered = list.filter(st => st !== stock)
    reordered.splice(list.indexOf(target), 0, stock)
    // Put the reordered list back into the slots that list holds in the full array
    let i = 0
    return { ...s, stocks: s.stocks.map(st => (!!st.watchlist === isWatch ? reordered[i++] : st)) }
  })
/** Put a removed stock back where it was (undo) */
export const restoreStock = (stock: Stock, index: number) =>
  commit(s => {
    if (s.stocks.some(st => st.id === stock.id)) return s
    const stocks = [...s.stocks]
    stocks.splice(Math.min(Math.max(index, 0), stocks.length), 0, stock)
    return { ...s, stocks }
  })
export const removeStock = (id: string) =>
  commit(s => ({ ...s, stocks: s.stocks.filter(st => st.id !== id) }))
export const refreshStockPrices = (
  updates: ({ id: string; currentPrice: number; priceHistory: number[] } & Partial<Pick<Stock, 'lastQuoteDay' | 'dayChangePct'>>)[]
) =>
  commit(s => ({
    ...s,
    lastStockUpdate: new Date().toISOString(),
    stocks: s.stocks.map(st => {
      const u = updates.find(u => u.id === st.id)
      if (!u) return st
      const { id: _id, ...fields } = u
      return { ...st, ...fields }
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
const cents = (n: number) => Math.round(n * 100) / 100

/**
 * A logged savings transfer can point at a savings account and/or a goal. Adding the
 * entry adds the money there; removing it (or undo) takes it back out — so the
 * Budget, Savings and Goals numbers never drift apart.
 */
function applySavingsLinks(s: AppState, e: BudgetEntry | undefined, sign: 1 | -1): AppState {
  if (!e || e.type !== 'expense' || e.category !== SAVINGS_CATEGORY) return s
  let next = s
  if (e.savingsAccountId) {
    next = {
      ...next,
      savings: next.savings.map(a => {
        if (a.id !== e.savingsAccountId) return a
        const balance = cents(a.balance + sign * e.amount)
        return { ...a, balance, history: upsertHistory(a.history, balance) }
      }),
    }
  }
  if (e.goalId) {
    next = {
      ...next,
      goals: next.goals.map(g => (g.id === e.goalId ? { ...g, currentAmount: Math.max(0, cents(g.currentAmount + sign * e.amount)) } : g)),
    }
  }
  return next
}

export const addBudgetEntry = (entry: BudgetEntry) =>
  commit(s => applySavingsLinks({ ...s, budget: [...s.budget, entry] }, entry, 1))
export const updateBudgetEntry = (id: string, updates: Partial<BudgetEntry>) =>
  commit(s => {
    const before = s.budget.find(b => b.id === id)
    if (!before) return s
    const after = { ...before, ...updates }
    // Reverse the old effect, then apply the new one (handles amount or link changes)
    const reverted = applySavingsLinks(s, before, -1)
    return applySavingsLinks({ ...reverted, budget: reverted.budget.map(b => (b.id === id ? after : b)) }, after, 1)
  })
export const removeBudgetEntry = (id: string) =>
  commit(s => applySavingsLinks({ ...s, budget: s.budget.filter(b => b.id !== id) }, s.budget.find(b => b.id === id), -1))

/**
 * Roll over recurring budget entries from the previous month into `month/year`.
 * Only runs once per month (tracked in recurringRolledOver). Safe to call multiple times.
 * Entries marked thisMonthOverride are rolled over using their originalRecurringAmount
 * so the temporary change reverts automatically the next month.
 */
export function rolloverRecurringEntries(month: number, year: number) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  if (state.recurringRolledOver.includes(monthKey)) return

  // Source = the most recent earlier month that has any entries. Looking only at the
  // immediately previous month meant one skipped month (or browsing ahead to a future
  // month, which marks it rolled over) dropped every recurring entry for good.
  const targetIdx = year * 12 + (month - 1)
  // Only months with recurring entries count as a source — a month holding nothing
  // but logged one-off purchases must not cut the recurring chain.
  const sourceIdx = state.budget
    .filter(b => b.recurring)
    .map(b => b.year * 12 + (b.month - 1))
    .filter(i => i < targetIdx && i >= targetIdx - 24)
    .reduce((best, i) => Math.max(best, i), -1)
  const prevMonth = (sourceIdx % 12) + 1
  const prevYear = Math.floor(sourceIdx / 12)

  const recurringFromPrev = sourceIdx < 0 ? [] : state.budget.filter(
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
      // Links to a savings account/goal are not copied: a carried-over entry
      // shouldn't silently add money to an account again each month
      const { thisMonthOverride: _a, originalRecurringAmount: _b, date: prevDate, savingsAccountId: _c, goalId: _d, ...rest } = r
      // Same day of the month in the new month (clamped, so the 31st → Feb 28)
      const day = prevDate ? Math.min(Number(prevDate.slice(8, 10)) || 1, new Date(year, month, 0).getDate()) : null
      return {
        ...rest,
        ...(day ? { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` } : {}),
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

/** Hide dashboard alerts. Only the most recent 200 keys are kept (old periods expire on their own). */
export const dismissAlerts = (keys: string[]) =>
  commit(s => {
    const fresh = keys.filter(k => !s.dismissedAlerts.includes(k))
    return fresh.length ? { ...s, dismissedAlerts: [...s.dismissedAlerts, ...fresh].slice(-200) } : s
  })

export const restoreAlerts = (keys: string[]) =>
  commit(s => ({ ...s, dismissedAlerts: s.dismissedAlerts.filter(k => !keys.includes(k)) }))

export const setBudgetMode = (mode: AppState['budgetMode']) =>
  commit(s => (s.budgetMode === mode ? s : { ...s, budgetMode: mode }))

/**
 * Move planned money from one category to another in one step, e.g. cover an
 * overspent "Starbucks" from unspent "Dining Out". A plan that reaches 0 is removed.
 */
export const moveBudgetPlan = (from: string, to: string, amount: number) => {
  if (!(amount > 0) || from === to) return
  commit(s => {
    const limits = { ...s.categoryLimits }
    const fromLeft = Math.round(((limits[from] ?? 0) - amount) * 100) / 100
    if (fromLeft > 0) limits[from] = fromLeft
    else delete limits[from]
    limits[to] = Math.round(((limits[to] ?? 0) + amount) * 100) / 100
    return { ...s, categoryLimits: limits }
  })
}

// Custom expense categories (e.g. "Starbucks"). Removing one only hides it from
// the picker — past entries keep their category.
export const addCustomCategory = (name: string) => {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!clean) return
  commit(s => s.customCategories.some(c => c.toLowerCase() === clean.toLowerCase())
    ? s
    : { ...s, customCategories: [...s.customCategories, clean] })
}

export const removeCustomCategory = (name: string) =>
  commit(s => ({ ...s, customCategories: s.customCategories.filter(c => c !== name) }))

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
    customCategories: [],
    budgetMode: 'simple',
    dismissedAlerts: [],
  }))
