import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, monthLabel, parseLocalDate } from '../../utils/finance'
import {
  addBudgetEntry, removeBudgetEntry, addCustomCategory, removeCustomCategory,
  setCategoryLimit, removeCategoryLimit,
} from '../../store/store'
import { VARIABLE_CATS, catColor, todayISO } from '../../utils/categories'
import { isVariableExpense, expensesByCategory, monthTotals } from '../../utils/budgetMath'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import {
  Plus, Trash2, X, Check, ChevronLeft, ChevronRight, Receipt, CalendarDays, Pencil,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import type { BudgetEntry } from '../../types'

const LAST_CAT_KEY = 'finance-home-last-spend-category'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors'

function shiftMonth(month: number, year: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta
  return { month: (idx % 12) + 1, year: Math.floor(idx / 12) }
}

function dayLabel(date: string) {
  const d = parseLocalDate(date)
  const today = todayISO()
  const yesterday = todayISO(new Date(Date.now() - 86_400_000))
  if (date === today) return 'Today'
  if (date === yesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Day an entry belongs to: its logged date, else the day it was added (older entries) */
const entryDay = (e: BudgetEntry) => e.date ?? (e.addedAt ? todayISO(new Date(e.addedAt)) : '')

export function Spending() {
  const { budget, bills, customCategories, categoryLimits } = useAppStore()
  const now = new Date()

  // ── Log form ─────────────────────────────────────────────────────────
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(() => {
    try { return localStorage.getItem(LAST_CAT_KEY) || 'Groceries' } catch { return 'Groceries' }
  })
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [manageCats, setManageCats] = useState(false)
  const [formError, setFormError] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  const pickerCats = [
    ...VARIABLE_CATS,
    ...customCategories.filter(c => !VARIABLE_CATS.some(v => v.toLowerCase() === c.toLowerCase())),
  ]
  const activeCat = pickerCats.includes(category) ? category : pickerCats[0]

  // ── Toast (logged / deleted, with undo) ──────────────────────────────
  const [toast, setToast] = useState<{ entry: BudgetEntry; kind: 'logged' | 'deleted' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (entry: BudgetEntry, kind: 'logged' | 'deleted') => {
    setToast({ entry, kind })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const undoToast = () => {
    if (!toast) return
    if (toast.kind === 'logged') removeBudgetEntry(toast.entry.id)
    else addBudgetEntry(toast.entry)
    setToast(null)
  }

  // ── Month view ───────────────────────────────────────────────────────
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [editingLimit, setEditingLimit] = useState<string | null>(null)
  const [limitInput, setLimitInput] = useState('')
  const [chartMode, setChartMode] = useState<'all' | 'variable'>('all')

  const navMonth = (delta: number) => {
    const { month, year } = shiftMonth(viewMonth, viewYear, delta)
    setViewMonth(month)
    setViewYear(year)
    setFilterCat(null)
  }

  const handleLog = () => {
    const amt = parseFloat(amount)
    if (!(amt > 0)) { setFormError('Enter how much you spent.'); amountRef.current?.focus(); return }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO()
    const d = parseLocalDate(day)
    const entry: BudgetEntry = {
      id: uuid(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      category: activeCat,
      description: note.trim() || activeCat,
      amount: Math.round(amt * 100) / 100,
      type: 'expense',
      recurring: false,
      date: day,
      addedAt: new Date().toISOString(),
    }
    addBudgetEntry(entry)
    try { localStorage.setItem(LAST_CAT_KEY, activeCat) } catch { /* quota */ }
    showToast(entry, 'logged')
    // Ready for the next one: keep category + date, clear amount + note
    setAmount('')
    setNote('')
    setFormError('')
    setViewMonth(entry.month)
    setViewYear(entry.year)
    amountRef.current?.focus()
  }

  const handleAddCategory = () => {
    const name = newCat.trim()
    if (!name) { setAddingCat(false); return }
    const existing = pickerCats.find(c => c.toLowerCase() === name.toLowerCase())
    if (!existing) addCustomCategory(name)
    setCategory(existing ?? name.replace(/\s+/g, ' ').slice(0, 40))
    setNewCat('')
    setAddingCat(false)
  }

  const handleDelete = (e: BudgetEntry) => {
    removeBudgetEntry(e.id)
    showToast(e, 'deleted')
  }

  const saveLimit = (cat: string) => {
    const val = parseFloat(limitInput)
    if (val > 0) setCategoryLimit(cat, val)
    else removeCategoryLimit(cat)
    setEditingLimit(null)
    setLimitInput('')
  }

  // Variable spending for the viewed month
  const varFor = (m: number, y: number) =>
    budget.filter(b => b.month === m && b.year === y && isVariableExpense(b))
  const monthVar = varFor(viewMonth, viewYear)
  const total = monthVar.reduce((s, b) => s + b.amount, 0)
  const prev = shiftMonth(viewMonth, viewYear, -1)
  const prevTotal = varFor(prev.month, prev.year).reduce((s, b) => s + b.amount, 0)
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  // Limits apply to everything in a category (bills + fixed + variable), same as Budget
  const allSpent = expensesByCategory(budget, bills, viewMonth, viewYear)

  const byCat = Object.entries(
    monthVar.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = (acc[b.category] ?? 0) + b.amount
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])
  const maxCat = byCat[0]?.[1] ?? 0

  // Everything spent in the viewed month: bills + recurring (fixed) + logged (variable)
  const totals = monthTotals(budget, bills, viewMonth, viewYear)
  const leftOver = totals.income - totals.expenses

  // Every month with any data (plus this month), newest first, for the jump-to menu
  const monthKeys = new Set(budget.map(b => b.year * 12 + (b.month - 1)))
  monthKeys.add(now.getFullYear() * 12 + now.getMonth())
  monthKeys.add(viewYear * 12 + (viewMonth - 1))
  const monthOptions = [...monthKeys].sort((a, b) => b - a).map(idx => {
    const month = (idx % 12) + 1
    const year = Math.floor(idx / 12)
    return {
      value: `${year}-${month}`,
      label: `${new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })} — ${formatCurrency(monthTotals(budget, bills, month, year).expenses)}`,
    }
  })

  // 6-month trend ending at the viewed month
  const trend = Array.from({ length: 6 }, (_, i) => {
    const { month, year } = shiftMonth(viewMonth, viewYear, i - 5)
    const variable = varFor(month, year).reduce((s, b) => s + b.amount, 0)
    return {
      month, year,
      label: monthLabel(month, year),
      total: Math.round((chartMode === 'all' ? monthTotals(budget, bills, month, year).expenses : variable) * 100) / 100,
    }
  })

  // Daily log, newest first, grouped by day
  const logEntries = monthVar
    .filter(b => !filterCat || b.category === filterCat)
    .sort((a, b) => entryDay(b).localeCompare(entryDay(a)) || b.addedAt.localeCompare(a.addedAt))
  const groups: { day: string; items: BudgetEntry[]; total: number }[] = []
  for (const e of logEntries) {
    const day = entryDay(e)
    let g = groups[groups.length - 1]
    if (!g || g.day !== day) { g = { day, items: [], total: 0 }; groups.push(g) }
    g.items.push(e)
    g.total += e.amount
  }

  const monthTitle = new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in pb-32 lg:pb-6">

      {/* ── Quick log form ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-brand-500/25 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-600/20 rounded-lg"><Receipt size={15} className="text-brand-400" /></div>
          <h3 className="font-semibold text-white">Log an expense</h3>
          <span className="text-xs text-gray-500 ml-auto">Goes to variable spending</span>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">How much?</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-semibold">$</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => { setAmount(e.target.value); setFormError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleLog() }}
              className={`${inputCls} pl-9 pr-4 py-3 text-2xl font-bold`}
              style={{ fontSize: '24px' }}
            />
          </div>
        </div>

        {/* Category chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">Category</label>
            {customCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setManageCats(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
              >
                {manageCats ? <><Check size={12} /> Done</> : <><Pencil size={11} /> Edit mine</>}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {pickerCats.map(c => {
              const selected = c === activeCat
              const isCustom = customCategories.includes(c)
              return (
                <div key={c} className="relative">
                  <button
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                      selected ? 'text-white border-transparent' : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                    }`}
                    style={selected ? { backgroundColor: catColor(c) + '40', borderColor: catColor(c) } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(c) }} />
                    {c}
                  </button>
                  {manageCats && isCustom && (
                    <button
                      type="button"
                      onClick={() => removeCustomCategory(c)}
                      title={`Remove ${c} (past entries are kept)`}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              )
            })}
            {addingCat ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  maxLength={40}
                  placeholder="e.g. Starbucks"
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCategory()
                    if (e.key === 'Escape') { setAddingCat(false); setNewCat('') }
                  }}
                  className={`${inputCls} w-36 px-3 py-1.5 text-sm`}
                  style={{ fontSize: '16px' }}
                />
                <button type="button" onClick={handleAddCategory} className="p-1.5 text-emerald-400 hover:text-emerald-300"><Check size={16} /></button>
                <button type="button" onClick={() => { setAddingCat(false); setNewCat('') }} className="p-1.5 text-gray-500 hover:text-gray-300"><X size={16} /></button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCat(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
              >
                <Plus size={13} /> New category
              </button>
            )}
          </div>
        </div>

        {/* Note + date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Note <span className="text-gray-500 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="What was it for?"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLog() }}
              className={`${inputCls} px-3 py-2.5 text-sm`}
              style={{ fontSize: '16px' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              max={todayISO(new Date(Date.now() + 366 * 86_400_000))}
              onChange={e => setDate(e.target.value)}
              className={`${inputCls} px-3 py-2.5 text-sm`}
              style={{ fontSize: '16px', colorScheme: 'dark' }}
            />
          </div>
        </div>

        {formError && <p className="text-xs text-rose-400">{formError}</p>}

        <button
          type="button"
          onClick={handleLog}
          className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors active:scale-[0.99]"
        >
          Log {parseFloat(amount) > 0 ? formatCurrency(parseFloat(amount)) : 'expense'} · {activeCat}
        </button>
      </div>

      {/* ── Month navigator + summary ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navMonth(-1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white">{monthTitle}</h2>
          <select
            aria-label="Jump to month"
            value={`${viewYear}-${viewMonth}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number)
              setViewYear(y); setViewMonth(m); setFilterCat(null)
            }}
            className="mt-1 max-w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
            style={{ fontSize: '16px', colorScheme: 'dark' }}
          >
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => { setViewMonth(now.getMonth() + 1); setViewYear(now.getFullYear()); setFilterCat(null) }}
              className="block mx-auto mt-1 text-xs text-brand-400 hover:text-brand-300"
            >
              Back to this month
            </button>
          )}
        </div>
        <button type="button" onClick={() => navMonth(1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Total for the month — everything, not just logged purchases */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-gray-500 mb-1">Total spent in {monthTitle}</p>
        <p className="text-3xl font-bold text-white">{formatCurrency(totals.expenses)}</p>
        {totals.expenses > 0 && (
          <>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex mt-3">
              <div className="h-full bg-indigo-500" style={{ width: `${(totals.fixedExpenses / totals.expenses) * 100}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${(totals.variableExpenses / totals.expenses) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Fixed {formatCurrency(totals.fixedExpenses)}
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Variable {formatCurrency(totals.variableExpenses)}
              </span>
            </div>
          </>
        )}
        {totals.income > 0 && (
          <p className={`text-xs mt-3 pt-3 border-t border-gray-800 ${leftOver >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(totals.income)} income · {leftOver >= 0
              ? `${formatCurrency(leftOver)} left over`
              : `${formatCurrency(-leftOver)} over your income`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Variable spending</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(total)}</p>
          {change !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${change > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {change > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(change).toFixed(0)}% vs {monthLabel(prev.month, prev.year)}
            </p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Purchases</p>
          <p className="text-2xl font-bold text-white">{monthVar.length}</p>
          {monthVar.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">avg {formatCurrency(total / monthVar.length)}</p>
          )}
        </div>
      </div>

      {/* ── By category ───────────────────────────────────────────────── */}
      {byCat.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
            <h3 className="font-semibold text-white flex-1">By category</h3>
            {filterCat && (
              <button type="button" onClick={() => setFilterCat(null)} className="flex items-center gap-1 text-xs text-brand-400">
                <X size={12} /> Show all
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-800/60">
            {byCat.map(([cat, amt]) => {
              const limit = categoryLimits[cat] ?? 0
              const spentInCat = allSpent[cat] ?? amt
              const pct = limit > 0 ? spentInCat / limit : 0
              const isEditing = editingLimit === cat
              return (
                <div key={cat} className={`px-4 py-3 sm:px-5 ${filterCat === cat ? 'bg-gray-800/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFilterCat(f => (f === cat ? null : cat))}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-white flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(cat) }} />
                          {cat}
                        </span>
                        <span className="text-sm font-semibold text-white shrink-0 ml-2">{formatCurrency(amt)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${maxCat > 0 ? (amt / maxCat) * 100 : 0}%`, backgroundColor: catColor(cat) }}
                        />
                      </div>
                      {limit > 0 && (
                        <p className={`text-xs mt-1 ${pct >= 1 ? 'text-rose-400' : pct >= 0.7 ? 'text-amber-400' : 'text-gray-500'}`}>
                          {formatCurrency(spentInCat)} of {formatCurrency(limit)} limit
                          {pct >= 1 ? ` · over by ${formatCurrency(spentInCat - limit)}` : ` · ${formatCurrency(limit - spentInCat)} left`}
                        </p>
                      )}
                    </button>
                    {isEditing ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          autoFocus
                          type="number"
                          inputMode="decimal"
                          placeholder="Limit"
                          value={limitInput}
                          onChange={e => setLimitInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLimit(cat); if (e.key === 'Escape') setEditingLimit(null) }}
                          className={`${inputCls} w-20 px-2 py-1 text-xs`}
                          style={{ fontSize: '16px' }}
                        />
                        <button type="button" onClick={() => saveLimit(cat)} className="p-1 text-emerald-400"><Check size={14} /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingLimit(cat); setLimitInput(limit > 0 ? String(limit) : '') }}
                        className="shrink-0 px-2 py-1 text-xs text-gray-500 hover:text-white border border-gray-700 rounded-lg"
                      >
                        {limit > 0 ? 'Limit' : 'Set limit'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 6-month trend ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-white">Spending by month</h3>
            <p className="text-xs text-gray-500">Tap a month to view it</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs shrink-0">
            {(['all', 'variable'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setChartMode(m)}
                className={`px-2.5 py-1.5 transition-colors ${chartMode === m ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m === 'all' ? 'All' : 'Variable'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), chartMode === 'all' ? 'Total spent' : 'Variable spending']} cursor={{ fill: '#ffffff08' }} />
            <Bar
              dataKey="total"
              radius={[4, 4, 0, 0]}
              className="cursor-pointer"
              onClick={(d: { month: number; year: number }) => { setViewMonth(d.month); setViewYear(d.year); setFilterCat(null) }}
            >
              {trend.map(t => (
                <Cell key={`${t.year}-${t.month}`} fill={t.month === viewMonth && t.year === viewYear ? '#6366f1' : '#4b5563'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Daily log ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <CalendarDays size={15} className="text-brand-400" />
          <h3 className="font-semibold text-white flex-1">
            {filterCat ? `${filterCat} purchases` : 'Every purchase'}
          </h3>
          <span className="text-xs text-gray-500">{logEntries.length}</span>
        </div>
        {groups.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-10 px-6">
            Nothing logged for {monthTitle} yet. Use the form above whenever you spend.
          </p>
        ) : (
          <div>
            {groups.map(g => (
              <div key={g.day || 'undated'}>
                <div className="flex justify-between px-5 py-2 bg-gray-800/40 text-xs">
                  <span className="font-medium text-gray-400">{g.day ? dayLabel(g.day) : 'No date'}</span>
                  <span className="text-gray-500">{formatCurrency(g.total)}</span>
                </div>
                <div className="divide-y divide-gray-800/60">
                  {g.items.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(e.category) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{e.description || e.category}</p>
                        {e.description && e.description !== e.category && (
                          <p className="text-xs text-gray-500">{e.category}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-rose-400 shrink-0">-{formatCurrency(e.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(e)}
                        className="p-2 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="px-5 py-3 text-xs text-gray-600 border-t border-gray-800">
          Everything here also counts in Budget as variable expenses. Bills and recurring entries are your fixed expenses.
        </p>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-32 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-700 text-sm px-4 py-3 rounded-2xl shadow-2xl animate-slide-up whitespace-nowrap max-w-[calc(100vw-2rem)]">
          {toast.kind === 'logged'
            ? <Check size={14} className="text-emerald-400 shrink-0" />
            : <Trash2 size={14} className="text-gray-400 shrink-0" />}
          <span className="text-gray-300 truncate">
            {toast.kind === 'logged' ? 'Logged' : 'Deleted'}{' '}
            <span className="text-white font-medium">{formatCurrency(toast.entry.amount)}</span> · {toast.entry.category}
          </span>
          <button
            type="button"
            onClick={undoToast}
            className="ml-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
