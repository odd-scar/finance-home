import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, monthLabel } from '../../utils/finance'
import {
  addBudgetEntry, removeBudgetEntry, updateBudgetEntry,
  updateBudgetEntryThisMonth, updateBudgetEntryGoingForward,
  rolloverRecurringEntries, setCategoryLimit, removeCategoryLimit,
} from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Plus, Trash2, Edit2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Zap, Search, X, RefreshCw, Check, Repeat,
  History, ArrowRight, CalendarDays, SlidersHorizontal,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { BudgetEntry } from '../../types'
import { PaycheckOverridePanel } from '../PaycheckOverride/PaycheckOverridePanel'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

const INCOME_CATS = ['Salary', 'Freelance', 'Investments', 'Business', 'Other Income']
const EXPENSE_CATS = [
  'Rent/Mortgage', 'Groceries', 'Transport', 'Utilities', 'Subscriptions',
  'Dining Out', 'Entertainment', 'Health', 'Shopping', 'Savings Transfer',
  'Debt Payments', 'Education', 'Insurance', 'Gifts', 'Other',
]

// Consistent per-category colors used across all views
const CAT_COLORS: Record<string, string> = {
  'Salary': '#10b981', 'Freelance': '#34d399', 'Investments': '#6ee7b7',
  'Business': '#059669', 'Other Income': '#a7f3d0',
  'Rent/Mortgage': '#6366f1', 'Groceries': '#0ea5e9', 'Transport': '#10b981',
  'Utilities': '#f59e0b', 'Subscriptions': '#f43f5e', 'Dining Out': '#a855f7',
  'Entertainment': '#ec4899', 'Health': '#14b8a6', 'Shopping': '#84cc16',
  'Savings Transfer': '#fb923c', 'Debt Payments': '#38bdf8', 'Education': '#4ade80',
  'Insurance': '#e879f9', 'Gifts': '#fbbf24', 'Other': '#6b7280',
}

const catColor = (cat: string) => CAT_COLORS[cat] ?? '#6b7280'

const expColors = EXPENSE_CATS.map(c => catColor(c))

// Quick-add presets (pre-fill the form)
const PRESETS = [
  { label: 'Rent', category: 'Rent/Mortgage', type: 'expense' as const, description: 'Monthly Rent' },
  { label: 'Groceries', category: 'Groceries', type: 'expense' as const, description: 'Groceries' },
  { label: 'Salary', category: 'Salary', type: 'income' as const, description: 'Monthly Salary' },
  { label: 'Utilities', category: 'Utilities', type: 'expense' as const, description: 'Utilities' },
]

const emptyForm = {
  category: 'Salary', description: '', amount: '',
  type: 'income' as 'income' | 'expense', recurring: false,
}

/** Format "YYYY-MM" → "Jan 2024" */
function fmtYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export function Budget() {
  const { budget, incomeHistory, categoryLimits } = useAppStore()
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date')
  const [showSortMenu, setShowSortMenu] = useState(false)
  // Spending limits
  const [showLimits, setShowLimits] = useState(false)
  const [editingLimitCat, setEditingLimitCat] = useState<string | null>(null)
  const [limitInput, setLimitInput] = useState('')

  // Smart income change — scope dialog
  const [updateScopeOpen, setUpdateScopeOpen] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; updates: Partial<BudgetEntry> } | null>(null)

  // Undo delete
  const [deletedEntry, setDeletedEntry] = useState<BudgetEntry | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Swipe-to-delete
  const touchStartX = useRef(0)
  const touchId = useRef<string | null>(null)
  const [swipeState, setSwipeState] = useState<{ id: string; x: number } | null>(null)

  // Roll over recurring entries whenever the viewed month changes
  useEffect(() => {
    rolloverRecurringEntries(viewMonth, viewYear)
  }, [viewMonth, viewYear])

  const navMonth = (dir: number) => {
    let m = viewMonth + dir, y = viewYear
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  const monthEntries = budget.filter(b => b.month === viewMonth && b.year === viewYear)
  const income = monthEntries.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
  const expenses = monthEntries.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const net = income - expenses
  const pct = income > 0 ? Math.min(200, (expenses / income) * 100) : 0

  // Last 6 months trend
  const trendData = []
  for (let i = 5; i >= 0; i--) {
    let m = viewMonth - i, y = viewYear
    if (m < 1) { m += 12; y-- }
    const entries = budget.filter(b => b.month === m && b.year === y)
    const inc = entries.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
    const exp = entries.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    trendData.push({ label: monthLabel(m, y), income: inc, expenses: exp, net: inc - exp })
  }

  // Category breakdown
  const expByCategory = EXPENSE_CATS.map((cat, i) => ({
    name: cat,
    value: monthEntries.filter(b => b.type === 'expense' && b.category === cat).reduce((s, b) => s + b.amount, 0),
    color: expColors[i % expColors.length],
  })).filter(d => d.value > 0)

  // Filtered + sorted transaction list
  const filtered = monthEntries
    .filter(b => filterType === 'all' || b.type === filterType)
    .filter(b => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return b.description.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount
      if (sortBy === 'category') return a.category.localeCompare(b.category)
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    })

  // ── Delete with undo ────────────────────────────────────────────────────
  const handleDelete = useCallback((entry: BudgetEntry) => {
    removeBudgetEntry(entry.id)
    setDeletedEntry(entry)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setDeletedEntry(null), 5000)
    setSwipeState(null)
  }, [])

  const handleUndo = () => {
    if (!deletedEntry) return
    addBudgetEntry(deletedEntry)
    setDeletedEntry(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }

  // ── Swipe to delete ─────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX
    touchId.current = id
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchId.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < -8) {
      setSwipeState({ id: touchId.current, x: Math.max(-120, dx) })
    } else if (dx > 8 && swipeState?.id === touchId.current) {
      setSwipeState(null)
    }
  }

  const handleTouchEnd = (entry: BudgetEntry) => {
    if (swipeState?.id === entry.id && swipeState.x < -72) {
      handleDelete(entry)
    } else {
      setSwipeState(null)
    }
    touchId.current = null
  }

  // ── Form actions ────────────────────────────────────────────────────────
  const handleAdd = () => {
    const entry: BudgetEntry = {
      id: uuid(),
      month: viewMonth, year: viewYear,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      type: form.type,
      recurring: form.recurring,
      addedAt: new Date().toISOString(),
    }
    addBudgetEntry(entry)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editEntry) return
    const updates: Partial<BudgetEntry> = {
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      type: form.type,
      recurring: form.recurring,
    }

    // For recurring income entries where the amount changed, ask how to apply the update
    const amountChanged = (updates.amount ?? 0) !== editEntry.amount
    if (editEntry.recurring && editEntry.type === 'income' && amountChanged) {
      setPendingUpdate({ id: editEntry.id, updates })
      setEditEntry(null)
      setUpdateScopeOpen(true)
      return
    }

    updateBudgetEntry(editEntry.id, updates)
    setEditEntry(null)
  }

  const handleUpdateScope = (scope: 'thisMonth' | 'forward') => {
    if (!pendingUpdate) return
    if (scope === 'thisMonth') {
      updateBudgetEntryThisMonth(pendingUpdate.id, pendingUpdate.updates)
    } else {
      updateBudgetEntryGoingForward(pendingUpdate.id, pendingUpdate.updates, viewMonth, viewYear)
    }
    setPendingUpdate(null)
    setUpdateScopeOpen(false)
    setForm({ ...emptyForm })
  }

  const openEdit = (e: BudgetEntry) => {
    const validCats = e.type === 'income' ? INCOME_CATS : EXPENSE_CATS
    const category = validCats.includes(e.category) ? e.category : validCats[0]
    setForm({ category, description: e.description, amount: String(e.amount), type: e.type, recurring: e.recurring ?? false })
    setEditEntry(e)
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setForm({ category: preset.category, description: preset.description, amount: '', type: preset.type, recurring: false })
    setAddOpen(true)
  }

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS

  const budgetFormJsx = (
    <div className="space-y-4">
      {/* Income / Expense toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700">
        <button type="button"
          onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Salary' }))}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
        >Income</button>
        <button type="button"
          onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'Groceries' }))}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-rose-500/20 text-rose-400' : 'text-gray-400 hover:text-white'}`}
        >Expense</button>
      </div>
      <FormField label="Category">
        <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </FormField>
      <FormField label="Description" hint="Optional">
        <Input placeholder="Brief description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </FormField>
      <FormField label="Amount ($)">
        <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
      </FormField>
      {/* Recurring toggle */}
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm text-gray-200 font-medium flex items-center gap-1.5">
            <Repeat size={13} className="text-brand-400" /> Recurring monthly
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Auto-carries over to next month</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${form.recurring ? 'bg-brand-600' : 'bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${form.recurring ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )

  // ── Income history grouped by source ───────────────────────────────────
  const historyGroups = incomeHistory.reduce<Record<string, typeof incomeHistory>>((acc, h) => {
    const key = `${h.category}::${h.description}`
    if (!acc[key]) acc[key] = []
    acc[key].push(h)
    return acc
  }, {})

  const sortedGroupKeys = Object.keys(historyGroups).sort()

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in pb-32 lg:pb-6">

      {/* ── Month navigator ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navMonth(-1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-white w-32 sm:w-44 text-center">
            {new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button type="button" onClick={() => navMonth(1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLimits(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 ${
              showLimits
                ? 'bg-brand-600/30 border-brand-500/50 text-brand-300'
                : 'bg-brand-600/10 border-brand-500/20 text-brand-400 hover:bg-brand-600/20'
            }`}
          >
            <SlidersHorizontal size={13} /> Limits
          </button>
          <button
            type="button"
            onClick={() => setOverrideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95"
          >
            <Zap size={13} /> Override
          </button>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}>
            <Plus size={14} /> Add Entry
          </Button>
        </div>
      </div>

      {/* ── Budget summary card (sticky top) ─────────────────────────── */}
      <div className={`border rounded-2xl p-4 ${net >= 0 ? 'bg-emerald-500/8 border-emerald-500/25' : 'bg-rose-500/8 border-rose-500/25'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><TrendingUp size={11} className="text-emerald-400" /> Income</p>
              <p className="text-sm font-bold text-emerald-400">{formatCurrency(income)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><TrendingDown size={11} className="text-rose-400" /> Expenses</p>
              <p className="text-sm font-bold text-rose-400">{formatCurrency(expenses)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Net</p>
            <p className={`text-lg font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {net >= 0 ? '+' : ''}{formatCurrency(net)}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        {income > 0 && (
          <>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {formatCurrency(expenses)} spent of {formatCurrency(income)} income ({pct.toFixed(0)}%)
            </p>
          </>
        )}
      </div>

      {/* ── Spending Limits Panel ────────────────────────────────────── */}
      {showLimits && (() => {
        // Build per-category rows: every expense category that has spend OR a limit
        const limitRows = EXPENSE_CATS.map(cat => {
          const spent = monthEntries
            .filter(b => b.type === 'expense' && b.category === cat)
            .reduce((s, b) => s + b.amount, 0)
          const limit = categoryLimits[cat] ?? 0
          const pct = limit > 0 ? spent / limit : 0
          return { cat, spent, limit, pct }
        }).filter(r => r.spent > 0 || r.limit > 0)

        const saveLimit = (cat: string) => {
          const val = parseFloat(limitInput)
          if (!isNaN(val) && val > 0) setCategoryLimit(cat, val)
          else if (val === 0 || limitInput === '') removeCategoryLimit(cat)
          setEditingLimitCat(null)
          setLimitInput('')
        }

        return (
          <div className="bg-gray-900 border border-brand-500/20 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <SlidersHorizontal size={14} className="text-brand-400" />
              <h3 className="text-sm font-semibold text-white">Spending Limits</h3>
              <span className="text-xs text-gray-500 ml-1">— set monthly caps per category</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {limitRows.length === 0 && (
                <p className="px-4 py-4 text-sm text-gray-500">
                  No expense entries this month yet. Add some transactions to see limits tracking.
                </p>
              )}
              {limitRows.map(({ cat, spent, limit, pct }) => {
                const barColor = pct >= 1 ? 'bg-rose-500' : pct >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                const isEditing = editingLimitCat === cat
                return (
                  <div key={cat} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-white">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{formatCurrency(spent)}</span>
                          {limit > 0 && (
                            <span className={`text-xs font-semibold ${pct >= 1 ? 'text-rose-400' : pct >= 0.7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              / {formatCurrency(limit)} {pct >= 1 ? '🔴' : pct >= 0.7 ? '🟡' : '🟢'}
                            </span>
                          )}
                        </div>
                      </div>
                      {limit > 0 && (
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(100, pct * 100).toFixed(0)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            placeholder="0"
                            value={limitInput}
                            onChange={e => setLimitInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveLimit(cat); if (e.key === 'Escape') { setEditingLimitCat(null); setLimitInput('') } }}
                            className="w-24 bg-gray-800 border border-brand-500/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => saveLimit(cat)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingLimitCat(null); setLimitInput('') }}
                            className="p-1 text-gray-500 hover:text-gray-300"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingLimitCat(cat); setLimitInput(limit > 0 ? String(limit) : '') }}
                          className="px-2.5 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
                        >
                          {limit > 0 ? 'Edit' : 'Set limit'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {limitRows.length === 0 && null}
          </div>
        )
      })()}

      {/* ── Quick-add presets ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <p className="text-xs text-gray-500 self-center shrink-0">Quick add:</p>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-700 hover:border-brand-600/60 hover:bg-gray-800 text-gray-300 hover:text-white transition-all active:scale-95"
          >
            + {p.label}
          </button>
        ))}
      </div>

      {/* ── Charts ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">6-Month Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {expByCategory.length > 0 && (() => {
          const TOP_N = 4
          const sorted = [...expByCategory].sort((a, b) => b.value - a.value)
          const hasMore = sorted.length > TOP_N
          const topSlices = sorted.slice(0, TOP_N)
          const otherValue = sorted.slice(TOP_N).reduce((s, d) => s + d.value, 0)
          const collapsed = hasMore && !showAllCategories
            ? [...topSlices, { name: 'Other', value: otherValue, color: '#6b7280' }]
            : sorted
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Expense Categories</h3>
                {hasMore && (
                  <button type="button" onClick={() => setShowAllCategories(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer">
                    {showAllCategories ? <><ChevronUp size={13} /> Less</> : <><ChevronDown size={13} /> All {sorted.length}</>}
                  </button>
                )}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={collapsed} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {collapsed.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
                  <Legend formatter={v => <span className="text-xs text-gray-300">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )
        })()}
      </div>

      {/* ── Transaction list ──────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 flex-wrap gap-y-3">
          <h3 className="font-semibold text-white flex-1">Transactions</h3>
          {/* Sort button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortMenu(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
            >
              <RefreshCw size={11} />
              {sortBy === 'date' ? 'Date' : sortBy === 'amount' ? 'Amount' : 'Category'}
              <ChevronDown size={11} />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-9 z-20 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[120px]">
                  {(['date', 'amount', 'category'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSortBy(s); setShowSortMenu(false) }}
                      className={`flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-gray-800 transition-colors capitalize ${sortBy === s ? 'text-brand-400' : 'text-gray-300'}`}
                    >
                      {s} {sortBy === s && <Check size={11} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Filter tabs */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            {(['all', 'income', 'expense'] as const).map(t => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 capitalize transition-colors ${filterType === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or category…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-600 transition-colors"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-800 max-h-64 sm:max-h-96 overflow-y-auto overscroll-contain">
          {filtered.length === 0 && monthEntries.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600/15 border border-brand-600/25 flex items-center justify-center mb-4">
                <TrendingUp size={24} className="text-brand-400" />
              </div>
              <h4 className="text-white font-semibold mb-1">No entries yet</h4>
              <p className="text-sm text-gray-500 mb-5 max-w-xs">
                Add your first income source or expense to start tracking this month.
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => { setForm({ ...emptyForm, type: 'income', category: 'Salary' }); setAddOpen(true) }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  <Plus size={14} /> Add Income
                </button>
                <button
                  type="button"
                  onClick={() => { setForm({ ...emptyForm, type: 'expense', category: 'Rent/Mortgage' }); setAddOpen(true) }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  <Plus size={14} /> Add Expense
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No results for "{searchQuery}"</p>
          ) : (
            filtered.map(entry => {
              const swipeX = swipeState?.id === entry.id ? swipeState.x : 0
              return (
                <div
                  key={entry.id}
                  className="relative overflow-hidden select-none"
                  onTouchStart={e => handleTouchStart(e, entry.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(entry)}
                >
                  {/* Swipe delete background */}
                  <div
                    className="absolute inset-y-0 right-0 flex items-center gap-2 px-5 bg-rose-500/90"
                    style={{ opacity: swipeX < -20 ? Math.min(1, Math.abs(swipeX) / 80) : 0 }}
                  >
                    <Trash2 size={16} className="text-white" />
                    <span className="text-white text-xs font-medium">Delete</span>
                  </div>
                  {/* Row content */}
                  <div
                    className="relative flex items-center gap-3 px-4 py-3 sm:px-5 sm:gap-4 bg-gray-900 transition-transform duration-75"
                    style={{ transform: `translateX(${swipeX}px)` }}
                  >
                    {/* Category color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: catColor(entry.category) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate flex items-center gap-1.5">
                        {entry.description || entry.category}
                        {entry.recurring && (
                          <span title="Recurring monthly"><Repeat size={11} className="text-brand-400 shrink-0" /></span>
                        )}
                        {entry.thisMonthOverride && (
                          <span title="One-time change — reverts next month" className="text-[10px] text-amber-400 font-medium border border-amber-400/30 rounded px-1 shrink-0">this month</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{entry.category}</p>
                    </div>
                    <span className={`font-semibold text-sm shrink-0 ${entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </span>
                    {/* Edit / delete buttons (desktop + tap on mobile) */}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="p-2.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg cursor-pointer touch-manipulation"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        className="p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer touch-manipulation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Income History ────────────────────────────────────────────── */}
      {sortedGroupKeys.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-brand-400" />
            <h3 className="font-semibold text-white">Income History</h3>
          </div>
          <div className="space-y-5">
            {sortedGroupKeys.map(key => {
              const [cat, desc] = key.split('::')
              const records = [...historyGroups[key]].sort((a, b) => a.startDate.localeCompare(b.startDate))
              return (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarDays size={11} />
                    {desc || cat}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {records.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
                          <p className="text-sm font-semibold text-emerald-400">{formatCurrency(r.amount)}<span className="text-gray-500 font-normal text-xs">/mo</span></p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {fmtYM(r.startDate)} – {r.endDate ? fmtYM(r.endDate) : <span className="text-brand-400 font-medium">present</span>}
                          </p>
                        </div>
                        {i < records.length - 1 && (
                          <ArrowRight size={14} className="text-gray-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-600 mt-4">History is recorded when you choose "Update going forward" on a recurring income entry.</p>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Budget Entry"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} className="flex-1">Add Entry</Button>
          </div>
        }
      >{budgetFormJsx}</Modal>

      <Modal
        open={!!editEntry}
        onClose={() => { setEditEntry(null); setForm({ ...emptyForm }) }}
        title="Edit Entry"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setEditEntry(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button>
            <Button onClick={handleEdit} className="flex-1">Save</Button>
          </div>
        }
      >{budgetFormJsx}</Modal>

      {/* ── Smart income update scope dialog ─────────────────────────── */}
      <Modal
        open={updateScopeOpen}
        onClose={() => { setUpdateScopeOpen(false); setPendingUpdate(null); setForm({ ...emptyForm }) }}
        title="How should we update this?"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            You're updating a recurring income entry. Choose how you'd like to apply this change:
          </p>
          <button
            type="button"
            onClick={() => handleUpdateScope('thisMonth')}
            className="w-full text-left p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-brand-600/50 rounded-xl transition-all group"
          >
            <p className="text-sm font-semibold text-white group-hover:text-brand-300">Update just this month</p>
            <p className="text-xs text-gray-500 mt-1">Amount changes for {new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })} only. Your usual recurring amount comes back next month automatically.</p>
          </button>
          <button
            type="button"
            onClick={() => handleUpdateScope('forward')}
            className="w-full text-left p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-500/50 rounded-xl transition-all group"
          >
            <p className="text-sm font-semibold text-white group-hover:text-emerald-300">Update going forward</p>
            <p className="text-xs text-gray-500 mt-1">Sets the new amount from this month onward. The previous amount is saved to your Income History so you have a full record of changes over time.</p>
          </button>
        </div>
      </Modal>

      <PaycheckOverridePanel open={overrideOpen} onClose={() => setOverrideOpen(false)} />

      {/* ── Undo delete toast ─────────────────────────────────────────── */}
      {deletedEntry && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-2xl shadow-2xl animate-slide-up whitespace-nowrap">
          <Trash2 size={14} className="text-gray-400 shrink-0" />
          <span className="text-gray-300">
            <span className="text-white font-medium">{deletedEntry.description || deletedEntry.category}</span> deleted
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="ml-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-colors active:scale-95"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
