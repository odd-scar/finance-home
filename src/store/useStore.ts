import { useState, useCallback } from 'react'
import { AppState, Stock, Debt, SavingsAccount, FinancialGoal, Trip, TripExpense, BudgetEntry, Bill, Asset, NetWorthSnapshot } from '../types'
import { demoStocks, demoDebts, demoSavings, demoGoals, demoTrips, demoBudget, demoBills, demoAssets } from '../data/demo'

const STORAGE_KEY = 'finance-home-data'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
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
    }
  } catch {}
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

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

let globalState: AppState = loadState()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(fn => fn())
}

function setState(updater: (prev: AppState) => AppState) {
  globalState = updater(globalState)
  saveState(globalState)
  notify()
}

export function useStore() {
  const [, forceUpdate] = useState(0)

  const subscribe = useCallback(() => {
    const update = () => forceUpdate(n => n + 1)
    listeners.add(update)
    return () => listeners.delete(update)
  }, [])

  // Use effect-like subscription
  if (typeof window !== 'undefined') {
    // Subscribe on first render (handled via useEffect in components)
  }

  return {
    state: globalState,
    subscribe,

    // Stocks
    addStock: (stock: Stock) => setState(s => ({ ...s, stocks: [...s.stocks, stock] })),
    updateStock: (id: string, updates: Partial<Stock>) =>
      setState(s => ({ ...s, stocks: s.stocks.map(st => st.id === id ? { ...st, ...updates } : st) })),
    removeStock: (id: string) => setState(s => ({ ...s, stocks: s.stocks.filter(st => st.id !== id) })),
    refreshStockPrices: (updates: { id: string; currentPrice: number; priceHistory: number[] }[]) =>
      setState(s => ({
        ...s,
        lastStockUpdate: new Date().toISOString(),
        stocks: s.stocks.map(st => {
          const u = updates.find(u => u.id === st.id)
          return u ? { ...st, currentPrice: u.currentPrice, priceHistory: u.priceHistory } : st
        }),
      })),

    // Debts
    addDebt: (debt: Debt) => setState(s => ({ ...s, debts: [...s.debts, debt] })),
    updateDebt: (id: string, updates: Partial<Debt>) =>
      setState(s => ({ ...s, debts: s.debts.map(d => d.id === id ? { ...d, ...updates } : d) })),
    removeDebt: (id: string) => setState(s => ({ ...s, debts: s.debts.filter(d => d.id !== id) })),

    // Savings
    addSavings: (account: SavingsAccount) => setState(s => ({ ...s, savings: [...s.savings, account] })),
    updateSavings: (id: string, updates: Partial<SavingsAccount>) =>
      setState(s => ({ ...s, savings: s.savings.map(a => a.id === id ? { ...a, ...updates } : a) })),
    removeSavings: (id: string) => setState(s => ({ ...s, savings: s.savings.filter(a => a.id !== id) })),

    // Goals
    addGoal: (goal: FinancialGoal) => setState(s => ({ ...s, goals: [...s.goals, goal] })),
    updateGoal: (id: string, updates: Partial<FinancialGoal>) =>
      setState(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g) })),
    removeGoal: (id: string) => setState(s => ({ ...s, goals: s.goals.filter(g => g.id !== id) })),

    // Trips
    addTrip: (trip: Trip) => setState(s => ({ ...s, trips: [...s.trips, trip] })),
    updateTrip: (id: string, updates: Partial<Trip>) =>
      setState(s => ({ ...s, trips: s.trips.map(t => t.id === id ? { ...t, ...updates } : t) })),
    removeTrip: (id: string) => setState(s => ({ ...s, trips: s.trips.filter(t => t.id !== id) })),
    addTripExpense: (tripId: string, expense: TripExpense) =>
      setState(s => ({
        ...s,
        trips: s.trips.map(t => t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t),
      })),
    updateTripExpense: (tripId: string, expenseId: string, updates: Partial<TripExpense>) =>
      setState(s => ({
        ...s,
        trips: s.trips.map(t =>
          t.id === tripId
            ? { ...t, expenses: t.expenses.map(e => e.id === expenseId ? { ...e, ...updates } : e) }
            : t
        ),
      })),
    removeTripExpense: (tripId: string, expenseId: string) =>
      setState(s => ({
        ...s,
        trips: s.trips.map(t =>
          t.id === tripId ? { ...t, expenses: t.expenses.filter(e => e.id !== expenseId) } : t
        ),
      })),

    // Budget
    addBudgetEntry: (entry: BudgetEntry) => setState(s => ({ ...s, budget: [...s.budget, entry] })),
    updateBudgetEntry: (id: string, updates: Partial<BudgetEntry>) =>
      setState(s => ({ ...s, budget: s.budget.map(b => b.id === id ? { ...b, ...updates } : b) })),
    removeBudgetEntry: (id: string) => setState(s => ({ ...s, budget: s.budget.filter(b => b.id !== id) })),

    // Bills
    addBill: (bill: Bill) => setState(s => ({ ...s, bills: [...s.bills, bill] })),
    updateBill: (id: string, updates: Partial<Bill>) =>
      setState(s => ({ ...s, bills: s.bills.map(b => b.id === id ? { ...b, ...updates } : b) })),
    removeBill: (id: string) => setState(s => ({ ...s, bills: s.bills.filter(b => b.id !== id) })),

    // Assets
    addAsset: (asset: Asset) => setState(s => ({ ...s, assets: [...s.assets, asset] })),
    updateAsset: (id: string, updates: Partial<Asset>) =>
      setState(s => ({ ...s, assets: s.assets.map(a => a.id === id ? { ...a, ...updates } : a) })),
    removeAsset: (id: string) => setState(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) })),

    // Net Worth History
    snapshotNetWorth: (snapshot: NetWorthSnapshot) =>
      setState(s => {
        const filtered = s.netWorthHistory.filter(h => h.month !== snapshot.month)
        return { ...s, netWorthHistory: [...filtered, snapshot].sort((a, b) => a.month.localeCompare(b.month)) }
      }),

    // Reset to demo data
    resetToDemo: () => {
      const fresh: AppState = {
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
      globalState = fresh
      saveState(fresh)
      notify()
    },
  }
}

export function useStoreSubscribed() {
  const store = useStore()
  const [, forceUpdate] = useState(0)

  // Subscribe to changes
  useState(() => {
    const update = () => forceUpdate(n => n + 1)
    listeners.add(update)
    return () => listeners.delete(update)
  })

  return store
}
