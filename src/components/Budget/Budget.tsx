import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, parseLocalDate } from '../../lib/finance'
import {
  addBudgetEntry, removeBudgetEntry, updateBudgetEntry,
  updateBudgetEntryThisMonth, updateBudgetEntryGoingForward,
  rolloverRecurringEntries, setCategoryLimit, removeCategoryLimit, moveBudgetPlan,
  setBudgetMode,
} from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import {
  Plus, Trash2, Edit2, ChevronLeft, ChevronRight, ChevronDown, Zap, Search, X, Check,
  Repeat, History, ArrowRight, CalendarDays, Receipt, List as ListIcon, BarChart3,
} from 'lucide-react'
import { BudgetEntry } from '../../types'
import { PaycheckOverridePanel } from '../PaycheckOverride/PaycheckOverridePanel'
import { monthPlan, monthTotals, coverSource, zeroBased, isFixedCategory, SAVINGS_CATEGORY, type FixedItem } from '../../lib/budgetMath'
import { INCOME_CATS, allExpenseCategories, catColor, todayISO } from '../../lib/categories'
import { LogForm } from './LogForm'
import { BudgetVsActualChart } from './BudgetVsActualChart'
import { MoneyInput } from '../ui/MoneyInput'
import { parseAmount } from '../../lib/mathExpr'

const CAT_VIEW_KEY = 'finance-home-budget-category-view'

// No width here — each input sets its own (w-full, w-36, …) so they never conflict
const inputCls =
  'bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors'

const catLabel = (c: string) => (c === SAVINGS_CATEGORY ? 'Savings' : c)

/** Format "YYYY-MM" → "Jan 2024" */
function fmtYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function dayLabel(date: string) {
  if (date === todayISO()) return 'Today'
  if (date === todayISO(new Date(Date.now() - 86_400_000))) return 'Yesterday'
  return parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const shiftMonth = (month: number, year: number, delta: number) => {
  const idx = year * 12 + (month - 1) + delta
  return { month: (idx % 12) + 1, year: Math.floor(idx / 12) }
}

/** Default date for a new entry: today in the current month, otherwise the 1st of the viewed month */
const emptyEdit = {
  category: 'Groceries', description: '', amount: '', date: '',
  type: 'expense' as 'income' | 'expense', recurring: false,
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${on ? 'bg-brand-600' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export function Budget() {
  const { budget, bills, incomeHistory, categoryLimits, customCategories, budgetMode } = useAppStore()
  const zeroMode = budgetMode === 'zero'
  const EXPENSE_CATS = allExpenseCategories(customCategories)
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [overrideOpen, setOverrideOpen] = useState(false)

  // Roll over recurring entries whenever the viewed month changes
  useEffect(() => {
    rolloverRecurringEntries(viewMonth, viewYear)
  }, [viewMonth, viewYear])

  const goTo = (month: number, year: number) => {
    setViewMonth(month)
    setViewYear(year)
    setFilterCat(null)
  }
  const navMonth = (delta: number) => {
    const t = shiftMonth(viewMonth, viewYear, delta)
    goTo(t.month, t.year)
  }

  const plan = monthPlan(budget, bills, categoryLimits, viewMonth, viewYear)
  const zb = zeroBased(plan)
  const heroTone = plan.income <= 0
    ? 'bg-gray-900 border-gray-800'
    : zeroMode
      ? zb.balanced ? 'bg-emerald-500/5 border-emerald-500/25'
        : zb.leftToAssign > 0 ? 'bg-amber-500/5 border-amber-500/25' : 'bg-rose-500/5 border-rose-500/25'
      : plan.leftToSpend >= 0 ? 'bg-emerald-500/5 border-emerald-500/25' : 'bg-rose-500/5 border-rose-500/25'
  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()
  const isPastMonth = viewYear * 12 + viewMonth < now.getFullYear() * 12 + now.getMonth() + 1
  const monthTitle = new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Jump-to-month menu: every month with data (plus this one), newest first, with its total
  const monthKeys = new Set(budget.map(b => b.year * 12 + (b.month - 1)))
  monthKeys.add(now.getFullYear() * 12 + now.getMonth())
  monthKeys.add(viewYear * 12 + (viewMonth - 1))
  const monthOptions = [...monthKeys].sort((a, b) => b - a).map(idx => {
    const month = (idx % 12) + 1
    const year = Math.floor(idx / 12)
    return {
      value: `${year}-${month}`,
      // Short enough to fit a phone header: "Oct 2026 · $8.5K spent"
      label: `${new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })} · ${formatCurrency(monthTotals(budget, bills, month, year).expenses, true)} spent`,
    }
  })

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

  // ── Log form lives in LogForm.tsx (shared with the "+" quick-add sheet) ──
  const [typeRequest, setTypeRequest] = useState<{ type: 'expense' | 'income'; n: number } | undefined>()
  const startIncome = () => setTypeRequest(r => ({ type: 'income', n: (r?.n ?? 0) + 1 }))

  // ── Category plan (plan vs actual, "cover it") ───────────────────────
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [planInput, setPlanInput] = useState('')
  const [filterCat, setFilterCat] = useState<string | null>(null)

  const startPlan = (cat: string, current: number) => {
    setEditingPlan(cat)
    setPlanInput(current > 0 ? String(current) : '')
  }
  const savePlan = (cat: string) => {
    const val = parseAmount(planInput)
    if (val > 0) setCategoryLimit(cat, Math.round(val * 100) / 100)
    else removeCategoryLimit(cat)
    setEditingPlan(null)
    setPlanInput('')
  }

  const planEditor = (category: string, planned: number) =>
    editingPlan === category ? (
      <div className="flex items-center gap-1 shrink-0">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          placeholder="Plan $"
          aria-label={`Monthly plan for ${catLabel(category)}`}
          value={planInput}
          onChange={e => setPlanInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') savePlan(category); if (e.key === 'Escape') setEditingPlan(null) }}
          className={`${inputCls} w-24 px-2 py-1.5 text-xs`}
          style={{ fontSize: '16px' }}
        />
        <button type="button" onClick={() => savePlan(category)} aria-label="Save plan" className="p-1 text-emerald-400"><Check size={16} /></button>
        {planned > 0 && (
          <button
            type="button"
            onClick={() => { removeCategoryLimit(category); setEditingPlan(null); setPlanInput('') }}
            aria-label={`Remove the ${catLabel(category)} plan`}
            title="Remove this plan (spending stays recorded)"
            className="p-1 text-rose-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    ) : (
      <button
        type="button"
        onClick={() => startPlan(category, planned)}
        aria-label={`${planned > 0 ? 'Edit' : 'Set'} the ${catLabel(category)} plan`}
        className="shrink-0 px-2 py-1 text-xs text-gray-500 hover:text-white border border-gray-700 rounded-lg"
      >
        {planned > 0 ? 'Edit' : 'Plan'}
      </button>
    )

  const [showUnplanned, setShowUnplanned] = useState(false)
  const [catView, setCatViewState] = useState<'list' | 'chart'>(() => {
    try { return localStorage.getItem(CAT_VIEW_KEY) === 'chart' ? 'chart' : 'list' } catch { return 'list' }
  })
  const setCatView = (v: 'list' | 'chart') => {
    setCatViewState(v)
    try { localStorage.setItem(CAT_VIEW_KEY, v) } catch { /* storage unavailable */ }
  }
  const planRows = editingPlan && !plan.rows.some(r => r.category === editingPlan)
    ? [...plan.rows, { category: editingPlan, spent: 0, planned: 0, remaining: 0 }]
    : plan.rows
  // Planned categories get the full plan-vs-actual treatment; everything else
  // (incl. fixed costs like rent) is summarized in one collapsible line
  const plannedRows = planRows.filter(r => r.planned > 0 || r.category === editingPlan)
  const unplannedRows = planRows.filter(r => !(r.planned > 0) && r.category !== editingPlan)
  const unplannedTotal = unplannedRows.reduce((s, r) => s + r.spent, 0)
  const unplannedOpen = showUnplanned || plannedRows.length === 0
  const unplannedCats = [...EXPENSE_CATS].filter(c => !isFixedCategory(c) && !planRows.some(r => r.category === c))

  // Where the month's income goes: fixed → spent → savings → left
  const savedSoFar = plan.byCategory[SAVINGS_CATEGORY] ?? 0
  const flexSpent = Math.max(0, plan.expenses - plan.fixedTotal - savedSoFar)
  const flow = [
    { key: 'fixed', label: 'Bills', amount: plan.fixedTotal, color: 'bg-sky-500', dot: 'bg-sky-500' },
    { key: 'spent', label: 'Spent', amount: flexSpent, color: 'bg-violet-500', dot: 'bg-violet-500' },
    { key: 'saved', label: 'Savings', amount: savedSoFar + plan.savingsReserve, color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'left', label: plan.leftToSpend < 0 ? 'Over' : 'Left', amount: Math.abs(plan.leftToSpend), color: plan.leftToSpend < 0 ? 'bg-rose-500' : 'bg-gray-600', dot: plan.leftToSpend < 0 ? 'bg-rose-500' : 'bg-gray-500' },
  ]
  const flowBase = Math.max(plan.income, flow.slice(0, 3).reduce((s, f) => s + f.amount, 0)) || 1
  const [fixedOpen, setFixedOpen] = useState(false)

  // ── Transactions ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [incomeOpen, setIncomeOpen] = useState(false)
  const q = search.trim().toLowerCase()
  const matches = (desc: string, cat: string) =>
    (!q || desc.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) && (!filterCat || cat === filterCat)

  // Fixed items live in their own section; the transaction list only shows them while searching
  const fixedIds = new Set(plan.fixedItems.map(i => i.id))
  const monthEntries = budget.filter(b => b.month === viewMonth && b.year === viewYear && matches(b.description, b.category))
  const incomeEntries = filterCat ? [] : monthEntries.filter(b => b.type === 'income')
  const searchedFixed = q ? plan.fixedItems.filter(i => matches(i.name, i.category)) : []
  const variableEntries = monthEntries.filter(b => b.type === 'expense' && !fixedIds.has(b.id))

  const incomeTotal = incomeEntries.reduce((s, b) => s + b.amount, 0)

  // Variable purchases by day, newest first; entries without a date go last
  const dayGroups: { day: string; items: BudgetEntry[]; total: number }[] = []
  for (const e of [...variableEntries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.addedAt.localeCompare(a.addedAt))) {
    const day = e.date ?? ''
    let g = dayGroups[dayGroups.length - 1]
    if (!g || g.day !== day) { g = { day, items: [], total: 0 }; dayGroups.push(g) }
    g.items.push(e)
    g.total += e.amount
  }
  const forceOpen = !!q || !!filterCat

  const handleDelete = (entry: BudgetEntry) => {
    removeBudgetEntry(entry.id)
    showToast(entry, 'deleted')
    setSwipeState(null)
  }

  // Swipe-to-delete (mobile)
  const touchStartX = useRef(0)
  const touchId = useRef<string | null>(null)
  const [swipeState, setSwipeState] = useState<{ id: string; x: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent, id: string) => { touchStartX.current = e.touches[0].clientX; touchId.current = id }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchId.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    if (dx < -8) setSwipeState({ id: touchId.current, x: Math.max(-120, dx) })
    else if (dx > 8 && swipeState?.id === touchId.current) setSwipeState(null)
  }
  const onTouchEnd = (entry: BudgetEntry) => {
    if (swipeState?.id === entry.id && swipeState.x < -72) handleDelete(entry)
    else setSwipeState(null)
    touchId.current = null
  }

  // ── Edit entry ───────────────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyEdit })
  const [updateScopeOpen, setUpdateScopeOpen] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; updates: Partial<BudgetEntry> } | null>(null)

  const openEdit = (e: BudgetEntry) => {
    setEditForm({
      category: e.category || (e.type === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]),
      description: e.description,
      amount: String(e.amount),
      date: e.date ?? '',
      type: e.type,
      recurring: e.recurring ?? false,
    })
    setEditEntry(e)
  }

  const handleEdit = () => {
    if (!editEntry) return
    const updates: Partial<BudgetEntry> = {
      category: editForm.category,
      description: editForm.description,
      amount: parseAmount(editForm.amount),
      type: editForm.type,
      recurring: editForm.recurring,
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(editForm.date)) {
      const d = parseLocalDate(editForm.date)
      updates.date = editForm.date
      updates.month = d.getMonth() + 1
      updates.year = d.getFullYear()
    }

    // Recurring income whose amount changed: ask whether it's a one-off or a raise
    if (editEntry.recurring && editEntry.type === 'income' && updates.amount !== editEntry.amount) {
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
      // Future months keep their own dates/months — only carry the amount/labels forward
      const { date: _d, month: _m, year: _y, ...rest } = pendingUpdate.updates
      updateBudgetEntryGoingForward(pendingUpdate.id, rest, viewMonth, viewYear)
    }
    setPendingUpdate(null)
    setUpdateScopeOpen(false)
  }

  const editBaseCats = editForm.type === 'income' ? INCOME_CATS : EXPENSE_CATS
  const editCats = editForm.category && !editBaseCats.includes(editForm.category) ? [...editBaseCats, editForm.category] : editBaseCats

  // ── Income history grouped by source ─────────────────────────────────
  const historyGroups = incomeHistory.reduce<Record<string, typeof incomeHistory>>((acc, h) => {
    const key = `${h.category}::${h.description}`
    ;(acc[key] ??= []).push(h)
    return acc
  }, {})
  const sortedGroupKeys = Object.keys(historyGroups).sort()

  // ── 50/30/20 reference ───────────────────────────────────────────────
  const splitBase = Math.max(plan.income, plan.split.needs + plan.split.wants + plan.split.savings)
  const pctOf = (v: number) => (plan.income > 0 ? Math.round((v / plan.income) * 100) : 0)

  const entryRow = (entry: BudgetEntry) => {
    const swipeX = swipeState?.id === entry.id ? swipeState.x : 0
    return (
      <div
        key={entry.id}
        className="relative overflow-hidden select-none"
        onTouchStart={e => onTouchStart(e, entry.id)}
        onTouchMove={onTouchMove}
        onTouchEnd={() => onTouchEnd(entry)}
      >
        <div
          className="absolute inset-y-0 right-0 flex items-center gap-2 px-5 bg-rose-500/90"
          style={{ opacity: swipeX < -20 ? Math.min(1, Math.abs(swipeX) / 80) : 0 }}
        >
          <Trash2 size={16} className="text-white" />
          <span className="text-white text-xs font-medium">Delete</span>
        </div>
        <div
          className="relative flex items-center gap-3 px-4 py-3 sm:px-5 bg-gray-900 transition-transform duration-75"
          style={{ transform: `translateX(${swipeX}px)` }}
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(entry.category) }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate flex items-center gap-1.5">
              {entry.description || entry.category}
              {entry.recurring && <span title="Repeats monthly"><Repeat size={11} className="text-brand-400 shrink-0" /></span>}
              {entry.thisMonthOverride && (
                <span title="One-time change — reverts next month" className="text-[10px] text-amber-400 font-medium border border-amber-400/30 rounded px-1 shrink-0">this month</span>
              )}
            </p>
            {entry.description && entry.description !== entry.category && (
              <p className="text-xs text-gray-500">{catLabel(entry.category)}</p>
            )}
          </div>
          <span className={`font-semibold text-sm shrink-0 ${entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
          </span>
          <button type="button" onClick={() => openEdit(entry)} className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg touch-manipulation" title="Edit">
            <Edit2 size={14} />
          </button>
          <button type="button" onClick={() => handleDelete(entry)} className="hidden sm:block p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  const groupHeader = (label: string, count: number, total: number, sign: '+' | '-', open: boolean, onToggle?: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      disabled={!onToggle}
      className="w-full flex items-center gap-2 px-5 py-2.5 bg-gray-800/40 text-xs text-left"
    >
      {onToggle && <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`} />}
      <span className="font-medium text-gray-300 flex-1">{label} <span className="text-gray-600">({count})</span></span>
      <span className={sign === '+' ? 'text-emerald-400' : 'text-gray-400'}>{sign}{formatCurrency(total)}</span>
    </button>
  )

  /** A must-pay: budget entries can be edited here; bills are managed on the Bills tab */
  const fixedRow = (item: FixedItem) => item.entry ? entryRow(item.entry) : (
    <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(item.category) }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {item.category} · from Bills
          {item.bill && item.bill.frequency !== 'monthly' && ` · ${formatCurrency(item.bill.amount)} ${item.bill.frequency}, set aside monthly`}
        </p>
      </div>
      <span className="text-sm font-semibold text-rose-400 shrink-0">-{formatCurrency(item.amount)}</span>
    </div>
  )
  // A logged entry in the same category as a bill is often the same payment counted twice
  const billCats = new Set(plan.fixedItems.filter(i => i.bill).map(i => i.category))
  const possibleDupes = plan.fixedItems.filter(i => i.entry && billCats.has(i.category))

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5 animate-fade-in pb-32 lg:pb-6 max-w-3xl mx-auto">

      {/* ── Month header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navMonth(-1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <select
            aria-label="Jump to month"
            value={`${viewYear}-${viewMonth}`}
            onChange={e => { const [y, m] = e.target.value.split('-').map(Number); goTo(m, y) }}
            className="max-w-full bg-transparent text-base sm:text-lg font-bold text-white text-center focus:outline-none cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            {monthOptions.map(o => <option key={o.value} value={o.value} className="text-sm font-normal bg-gray-900">{o.label}</option>)}
          </select>
          {!isCurrentMonth && (
            <button type="button" onClick={() => goTo(now.getMonth() + 1, now.getFullYear())} className="block mx-auto text-xs text-brand-400 hover:text-brand-300">
              Back to this month
            </button>
          )}
        </div>
        <button type="button" onClick={() => navMonth(1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setOverrideOpen(true)}
          title="Paycheck Override"
          className="p-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 rounded-xl"
        >
          <Zap size={15} />
        </button>
      </div>

      {/* ── Top card: Simple (left to spend) or Zero-based (left to assign) ── */}
      <div className={`border rounded-2xl p-5 ${heroTone}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs text-gray-400">
            {zeroMode
              ? 'Left to assign'
              : isPastMonth ? (plan.leftToSpend >= 0 ? 'Left over' : 'Overspent') : 'Left to spend'}
          </p>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-[11px] shrink-0" role="group" aria-label="Budget style">
            {(['simple', 'zero'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setBudgetMode(m)}
                title={m === 'zero' ? 'Zero-based: give every dollar of income a job' : 'Simple: see what you have left to spend'}
                className={`px-2 py-1 transition-colors ${budgetMode === m ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m === 'simple' ? 'Simple' : 'Zero-based'}
              </button>
            ))}
          </div>
        </div>

        {plan.income <= 0 ? (
          <div className="text-center py-1">
            <p className="text-sm text-gray-300 mb-1">Spent in {monthTitle}: <span className="font-semibold text-white">{formatCurrency(plan.expenses)}</span></p>
            <p className="text-xs text-gray-500 mb-3">
              {zeroMode ? 'Add your income to start giving every dollar a job.' : "Add your income to see what's left to spend."}
            </p>
            <button type="button" onClick={startIncome} className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium">
              <Plus size={13} className="inline -mt-0.5" /> Add income
            </button>
          </div>
        ) : zeroMode ? (
          <>
            <p className={`text-3xl font-bold ${zb.balanced ? 'text-emerald-400' : zb.leftToAssign > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {zb.leftToAssign < 0 && '-'}{formatCurrency(Math.abs(zb.leftToAssign))}
            </p>
            <p className="text-sm text-gray-300 mt-0.5">
              {zb.balanced
                ? 'Every dollar has a job ✓'
                : zb.leftToAssign > 0
                  ? 'still needs a job'
                  : plan.expenses >= plan.income
                    // Already spent past income — no plan change can fix that
                    ? `spent ${formatCurrency(plan.expenses - plan.income)} more than this month's income`
                    : 'more assigned than you earn — lower a plan below'}
            </p>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full ${zb.leftToAssign < 0 ? 'bg-rose-500' : zb.balanced ? 'bg-emerald-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(100, (zb.assigned / plan.income) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {formatCurrency(zb.assigned)} assigned of {formatCurrency(plan.income)} income
              <span className="text-gray-600"> · bills & spending count automatically</span>
            </p>
            {zb.leftToAssign > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setCategoryLimit(SAVINGS_CATEGORY, Math.round(((categoryLimits[SAVINGS_CATEGORY] ?? 0) + zb.leftToAssign) * 100) / 100)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                >
                  Assign {formatCurrency(zb.leftToAssign)} to Savings
                </button>
                <span className="text-xs text-gray-500 self-center">or plan it in a category below</span>
              </div>
            )}
            {!isPastMonth && (
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-800">
                Left to spend: <span className={plan.leftToSpend >= 0 ? 'text-white' : 'text-rose-400'}>{plan.leftToSpend < 0 && '-'}{formatCurrency(Math.abs(plan.leftToSpend))}</span>
                {plan.perDay !== null && plan.leftToSpend > 0 && ` · ${formatCurrency(plan.perDay)}/day`}
              </p>
            )}
          </>
        ) : (
          <>
            <p className={`text-3xl font-bold ${plan.leftToSpend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {plan.leftToSpend < 0 && '-'}{formatCurrency(Math.abs(plan.leftToSpend))}
            </p>
            {plan.perDay !== null && plan.leftToSpend > 0 && (
              <p className="text-sm text-gray-300 mt-0.5">
                {formatCurrency(plan.perDay)}/day for {plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'}
              </p>
            )}
            {/* Where this month's income goes — one bar, four plain labels */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-xs text-gray-400 mb-1.5">
                <span>Income this month</span>
                <span className="font-semibold text-gray-200">{formatCurrency(plan.income)}</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex gap-px" aria-hidden="true">
                {flow.filter(f => f.key !== 'left' || plan.leftToSpend > 0).map(f => (
                  <div key={f.key} className={`h-full ${f.color}`} style={{ width: `${(f.amount / flowBase) * 100}%` }} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                {flow.map(f => (
                  <div key={f.key} className="flex items-center gap-2 text-xs min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${f.dot}`} />
                    <span className="text-gray-400 truncate flex-1">{f.label}</span>
                    <span className={`font-medium shrink-0 ${f.key === 'left' && plan.leftToSpend < 0 ? 'text-rose-400' : 'text-gray-200'}`}>{formatCurrency(f.amount)}</span>
                  </div>
                ))}
              </div>
              {splitBase > 0 && (
                <p className="text-[11px] text-gray-500 mt-3" title="A common guide: 50% needs, 30% wants, 20% savings">
                  Needs {pctOf(plan.split.needs)}% · Wants {pctOf(plan.split.wants)}% · Savings {pctOf(plan.split.savings)}%
                  <span className="text-gray-600"> (guide: 50 / 30 / 20)</span>
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Log form (shared with the + quick-add sheet) ─────────────── */}
      <LogForm
        month={viewMonth}
        year={viewYear}
        typeRequest={typeRequest}
        onLogged={e => { if (e.month !== viewMonth || e.year !== viewYear) goTo(e.month, e.year) }}
      />

      {/* ── Spending plan: flexible categories, plan vs actual ─────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white">Spending plan</h3>
            <p className="text-xs text-gray-500">Flexible spending you can control</p>
          </div>
          {plannedRows.length > 0 && (
            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs" role="group" aria-label="Category view">
              {(['list', 'chart'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCatView(v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${catView === v ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {v === 'list' ? <ListIcon size={12} /> : <BarChart3 size={12} />} {v === 'list' ? 'List' : 'Chart'}
                </button>
              ))}
            </div>
          )}
        </div>

        {plannedRows.length === 0 && unplannedRows.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-500 text-center">Nothing spent yet this month. Plan a category below, then log what you spend.</p>
        )}

        {/* Budgeted vs actual for each planned category */}
        {catView === 'chart' && plannedRows.length > 0 && (
          <BudgetVsActualChart rows={plannedRows.filter(r => r.planned > 0)} />
        )}

        {/* Planned categories: spent vs plan, "cover it" when over */}
        <div className={`divide-y divide-gray-800/60 ${catView === 'chart' ? 'hidden' : ''}`}>
          {plannedRows.map(row => {
            const { category, spent, planned, remaining } = row
            const isSavings = category === SAVINGS_CATEGORY
            const over = !isSavings && planned > 0 && remaining < 0
            const donor = over ? coverSource(planRows, category) : null
            const coverAmt = donor ? Math.min(-remaining, donor.remaining) : 0
            const pct = planned > 0 ? spent / planned : 0
            const barColor = isSavings ? 'bg-emerald-500' : pct >= 1 ? 'bg-rose-500' : pct >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div key={category} className={`px-4 py-3.5 sm:px-5 ${filterCat === category ? 'bg-gray-800/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFilterCat(f => (f === category ? null : category))} className="flex-1 min-w-0 text-left" title="Show these transactions">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-medium text-white flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(category) }} />
                        {catLabel(category)}
                      </span>
                      <span className={`text-sm font-semibold shrink-0 ${over ? 'text-rose-400' : isSavings && remaining <= 0 ? 'text-emerald-400' : pct >= 0.8 && !isSavings ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {planned <= 0
                          ? <span className="text-gray-500 font-normal">New plan</span>
                          : isSavings
                          ? remaining <= 0 ? 'Goal met ✓' : `${formatCurrency(remaining)} to go`
                          : over ? `${formatCurrency(-remaining)} over` : `${formatCurrency(remaining)} left`}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {formatCurrency(spent)} of {formatCurrency(planned)}{isSavings ? ' saved' : ' spent'}
                      {isSavings && remaining < 0 && ` · ${formatCurrency(-remaining)} extra`}
                    </p>
                  </button>
                  {planEditor(category, planned)}
                </div>
                {donor && coverAmt > 0 && (
                  <button
                    type="button"
                    onClick={() => moveBudgetPlan(donor.category, category, coverAmt)}
                    className="mt-2 w-full text-left text-xs px-3 py-2 rounded-lg bg-brand-600/10 border border-brand-600/30 text-brand-300 hover:bg-brand-600/20"
                  >
                    Cover {formatCurrency(coverAmt)} from {catLabel(donor.category)}
                    <span className="text-gray-500"> ({formatCurrency(donor.remaining)} unspent)</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Everything without a plan, summarized in one line */}
        {unplannedRows.length > 0 && (
          <div className={plannedRows.length > 0 ? 'border-t border-gray-800' : ''}>
            {plannedRows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUnplanned(v => !v)}
                className="w-full flex items-center gap-2 px-5 py-3 text-left"
              >
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${unplannedOpen ? '' : '-rotate-90'}`} />
                <span className="text-sm text-gray-300 flex-1">
                  Not planned <span className="text-gray-600">({unplannedRows.length})</span>
                  {zeroMode && <span className="block text-[11px] text-gray-500">counted as assigned at what they cost</span>}
                </span>
                <span className="text-sm text-gray-400">{formatCurrency(unplannedTotal)}</span>
              </button>
            )}
            {unplannedOpen && (
              <div className="divide-y divide-gray-800/40">
                {unplannedRows.map(({ category, spent }) => (
                  <div key={category} className={`flex items-center gap-3 px-5 py-2.5 ${filterCat === category ? 'bg-gray-800/50' : ''}`}>
                    <button type="button" onClick={() => setFilterCat(f => (f === category ? null : category))} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(category) }} />
                      <span className="text-sm text-gray-300 truncate flex-1">{catLabel(category)}</span>
                      <span className="text-sm text-gray-400 shrink-0">{formatCurrency(spent)}</span>
                    </button>
                    {planEditor(category, 0)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {unplannedCats.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-800">
            <select
              aria-label="Plan a category"
              value=""
              onChange={e => { if (e.target.value) startPlan(e.target.value, 0) }}
              className="w-full bg-transparent border border-dashed border-gray-700 hover:border-brand-500 rounded-xl px-3 py-2.5 text-sm text-brand-300 text-center focus:outline-none focus:border-brand-500 cursor-pointer"
              style={{ fontSize: '16px', colorScheme: 'dark' }}
            >
              <option value="">+ Plan another category</option>
              {unplannedCats.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
            {plannedRows.length === 0 && (
              <p className="text-xs text-gray-600 mt-2">
                {zeroMode
                  ? 'Zero-based: plan categories until “Left to assign” reaches $0. Bills and fixed costs already count.'
                  : 'Tip: plan the categories you want to control (like groceries or coffee). Plan “Savings” to set money aside first.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bills & fixed: must-pays, no plan needed ──────────────────── */}
      {plan.fixedItems.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setFixedOpen(v => !v)}
            aria-expanded={fixedOpen}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-800/40"
          >
            <span className="p-2 rounded-xl bg-sky-500/15 text-sky-400 shrink-0"><Receipt size={15} /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-white">Bills & fixed <span className="text-gray-500 font-normal text-sm">({plan.fixedItems.length})</span></span>
              <span className="block text-xs text-gray-500">Must-pays, counted automatically. No plan needed.</span>
            </span>
            <span className="text-sm font-semibold text-gray-200 shrink-0">{formatCurrency(plan.fixedTotal)}</span>
            <ChevronDown size={15} className={`text-gray-500 shrink-0 transition-transform ${fixedOpen ? 'rotate-180' : ''}`} />
          </button>
          {possibleDupes.length > 0 && (
            <p className="mx-5 mb-3 text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300">
              Counted twice? {possibleDupes.map(i => `“${i.name}”`).join(', ')} {possibleDupes.length === 1 ? 'is' : 'are'} logged here and the Bills tab has a bill in the same category. If it’s the same payment, delete the logged one.
            </p>
          )}
          {fixedOpen && (
            <div className="border-t border-gray-800 divide-y divide-gray-800/60">
              {plan.fixedItems.map(fixedRow)}
              <p className="px-5 py-2.5 text-[11px] text-gray-600">
                Bills come from the Bills tab. Rent, insurance, debt payments, subscriptions, and anything set to repeat monthly land here too.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Transactions ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search transactions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-600"
              style={{ fontSize: '16px' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>
          {filterCat && (
            <button type="button" onClick={() => setFilterCat(null)} className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 shrink-0">
              {catLabel(filterCat)} <X size={11} />
            </button>
          )}
        </div>

        {incomeEntries.length === 0 && searchedFixed.length === 0 && dayGroups.length === 0 ? (
          <p className="text-center text-gray-500 py-10 text-sm px-6">
            {q || filterCat ? 'Nothing matches.' : `Nothing logged for ${monthTitle} yet.`}
          </p>
        ) : (
          <div>
            {incomeEntries.length > 0 && (
              <div>
                {groupHeader('Income', incomeEntries.length, incomeTotal, '+', forceOpen || incomeOpen,
                  forceOpen ? undefined : () => setIncomeOpen(v => !v))}
                {(forceOpen || incomeOpen) && <div className="divide-y divide-gray-800/60">{incomeEntries.map(entryRow)}</div>}
              </div>
            )}

            {searchedFixed.length > 0 && (
              <div>
                {groupHeader('Bills & fixed', searchedFixed.length, searchedFixed.reduce((s, i) => s + i.amount, 0), '-', true)}
                <div className="divide-y divide-gray-800/60">{searchedFixed.map(fixedRow)}</div>
              </div>
            )}

            {dayGroups.map(g => (
              <div key={g.day || 'undated'}>
                {groupHeader(g.day ? dayLabel(g.day) : 'Earlier (no date)', g.items.length, g.total, '-', true)}
                <div className="divide-y divide-gray-800/60">{g.items.map(entryRow)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Income history (collapsed) ────────────────────────────────── */}
      {sortedGroupKeys.length > 0 && (
        <details className="bg-gray-900 border border-gray-800 rounded-2xl group">
          <summary className="flex items-center gap-2 px-5 py-4 cursor-pointer list-none">
            <History size={15} className="text-brand-400" />
            <span className="font-semibold text-white flex-1">Income history</span>
            <ChevronDown size={15} className="text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5 space-y-5">
            {sortedGroupKeys.map(key => {
              const [cat, desc] = key.split('::')
              const records = [...historyGroups[key]].sort((a, b) => a.startDate.localeCompare(b.startDate))
              return (
                <div key={key}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarDays size={11} /> {desc || cat}
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
                        {i < records.length - 1 && <ArrowRight size={14} className="text-gray-600 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-gray-600">Recorded when you choose "Update going forward" on recurring income.</p>
          </div>
        </details>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────── */}
      <Modal
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        title="Edit Entry"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEditEntry(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleEdit} className="flex-1">Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {(['income', 'expense'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setEditForm(f => ({ ...f, type: t, category: t === 'income' ? 'Salary' : 'Groceries' }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${editForm.type === t
                  ? t === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  : 'text-gray-400 hover:text-white'}`}
              >
                {t === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>
          <FormField label="Category">
            <Select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
              {editCats.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </Select>
          </FormField>
          <FormField label="Description" hint="Optional">
            <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount ($)">
              <MoneyInput value={editForm.amount} onChange={v => setEditForm(f => ({ ...f, amount: v }))} />
            </FormField>
            <FormField label="Date">
              <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={{ colorScheme: 'dark' }} />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Toggle on={editForm.recurring} onClick={() => setEditForm(f => ({ ...f, recurring: !f.recurring }))} />
            <p className="text-sm text-gray-200">Repeats monthly</p>
          </div>
        </div>
      </Modal>

      {/* ── Recurring income change: one-off or going forward ─────────── */}
      <Modal
        open={updateScopeOpen}
        onClose={() => { setUpdateScopeOpen(false); setPendingUpdate(null) }}
        title="How should we update this?"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-400">You're changing a recurring income amount.</p>
          <button
            type="button"
            onClick={() => handleUpdateScope('thisMonth')}
            className="w-full text-left p-4 bg-gray-800 border border-gray-700 hover:border-brand-600/50 rounded-xl transition-all group"
          >
            <p className="text-sm font-semibold text-white group-hover:text-brand-300">Just this month</p>
            <p className="text-xs text-gray-500 mt-1">Only {monthTitle} changes. Your usual amount comes back next month.</p>
          </button>
          <button
            type="button"
            onClick={() => handleUpdateScope('forward')}
            className="w-full text-left p-4 bg-gray-800 border border-gray-700 hover:border-emerald-500/50 rounded-xl transition-all group"
          >
            <p className="text-sm font-semibold text-white group-hover:text-emerald-300">From now on</p>
            <p className="text-xs text-gray-500 mt-1">New amount from this month onward. The old amount is saved to Income history.</p>
          </button>
        </div>
      </Modal>

      <PaycheckOverridePanel open={overrideOpen} onClose={() => setOverrideOpen(false)} />

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-32 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-700 text-sm px-4 py-3 rounded-2xl shadow-2xl animate-slide-up whitespace-nowrap max-w-[calc(100vw-2rem)]">
          {toast.kind === 'logged' ? <Check size={14} className="text-emerald-400 shrink-0" /> : <Trash2 size={14} className="text-gray-400 shrink-0" />}
          <span className="text-gray-300 truncate">
            {toast.kind === 'logged' ? (toast.entry.type === 'income' ? 'Added' : 'Logged') : 'Deleted'}{' '}
            <span className="text-white font-medium">{formatCurrency(toast.entry.amount)}</span> · {catLabel(toast.entry.category)}
          </span>
          <button type="button" onClick={undoToast} className="ml-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg">
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
