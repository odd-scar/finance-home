import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, parseLocalDate } from '../../utils/finance'
import {
  addBudgetEntry, removeBudgetEntry, updateBudgetEntry,
  updateBudgetEntryThisMonth, updateBudgetEntryGoingForward,
  rolloverRecurringEntries, setCategoryLimit, removeCategoryLimit, moveBudgetPlan,
  addCustomCategory, removeCustomCategory, setBudgetMode,
} from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import {
  Plus, Trash2, Edit2, ChevronLeft, ChevronRight, ChevronDown, Zap, Search, X, Check,
  Repeat, History, ArrowRight, CalendarDays, Pencil, Receipt,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { BudgetEntry } from '../../types'
import { PaycheckOverridePanel } from '../PaycheckOverride/PaycheckOverridePanel'
import { monthPlan, monthTotals, coverSource, zeroBased, SAVINGS_CATEGORY, type BillItem } from '../../utils/budgetMath'
import { INCOME_CATS, VARIABLE_CATS, allExpenseCategories, catColor, todayISO } from '../../utils/categories'
import { MoneyInput } from '../ui/MoneyInput'
import { parseAmount } from '../../utils/mathExpr'

const LAST_CAT_KEY = 'finance-home-last-spend-category'

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
const defaultDateFor = (month: number, year: number) => {
  const now = new Date()
  return now.getMonth() + 1 === month && now.getFullYear() === year
    ? todayISO()
    : `${year}-${String(month).padStart(2, '0')}-01`
}

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

  // ── Log form (the one way to add money in or out) ────────────────────
  const [logType, setLogType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [expenseCat, setExpenseCat] = useState(() => {
    try { return localStorage.getItem(LAST_CAT_KEY) || 'Groceries' } catch { return 'Groceries' }
  })
  const [incomeCat, setIncomeCat] = useState('Salary')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => defaultDateFor(viewMonth, viewYear))
  const [recurring, setRecurring] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [manageCats, setManageCats] = useState(false)
  const [formError, setFormError] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDate(defaultDateFor(viewMonth, viewYear)) }, [viewMonth, viewYear])

  const pickerCats = logType === 'income'
    ? INCOME_CATS
    : [...VARIABLE_CATS, ...customCategories.filter(c => !VARIABLE_CATS.some(v => v.toLowerCase() === c.toLowerCase()))]
  const chosen = logType === 'income' ? incomeCat : expenseCat
  const activeCat = pickerCats.includes(chosen) ? chosen : pickerCats[0]
  const setChosen = (c: string) => (logType === 'income' ? setIncomeCat(c) : setExpenseCat(c))

  const startIncome = () => {
    setLogType('income')
    setRecurring(true)
    amountRef.current?.focus()
  }

  const handleLog = () => {
    const amt = parseAmount(amount)
    if (!(amt > 0)) { setFormError('Enter an amount.'); amountRef.current?.focus(); return }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : defaultDateFor(viewMonth, viewYear)
    const d = parseLocalDate(day)
    const entry: BudgetEntry = {
      id: uuid(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      category: activeCat,
      description: note.trim() || activeCat,
      amount: Math.round(amt * 100) / 100,
      type: logType,
      recurring,
      date: day,
      addedAt: new Date().toISOString(),
    }
    addBudgetEntry(entry)
    if (logType === 'expense') {
      try { localStorage.setItem(LAST_CAT_KEY, activeCat) } catch { /* quota */ }
    }
    showToast(entry, 'logged')
    // Ready for the next one: keep type/category/date, clear amount + note
    setAmount('')
    setNote('')
    setFormError('')
    if (entry.month !== viewMonth || entry.year !== viewYear) goTo(entry.month, entry.year)
    amountRef.current?.focus()
  }

  const handleAddCategory = () => {
    const name = newCat.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (name) {
      const existing = pickerCats.find(c => c.toLowerCase() === name.toLowerCase())
      if (!existing) addCustomCategory(name)
      setExpenseCat(existing ?? name)
    }
    setNewCat('')
    setAddingCat(false)
  }

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
          type="number"
          inputMode="decimal"
          placeholder="Plan"
          value={planInput}
          onChange={e => setPlanInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') savePlan(category); if (e.key === 'Escape') setEditingPlan(null) }}
          className={`${inputCls} w-20 px-2 py-1 text-xs`}
          style={{ fontSize: '16px' }}
        />
        <button type="button" onClick={() => savePlan(category)} className="p-1 text-emerald-400"><Check size={14} /></button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => startPlan(category, planned)}
        className="shrink-0 px-2 py-1 text-xs text-gray-500 hover:text-white border border-gray-700 rounded-lg"
      >
        {planned > 0 ? 'Edit' : 'Plan'}
      </button>
    )

  const [showUnplanned, setShowUnplanned] = useState(false)
  const planRows = editingPlan && !plan.rows.some(r => r.category === editingPlan)
    ? [...plan.rows, { category: editingPlan, spent: 0, planned: 0, remaining: 0 }]
    : plan.rows
  // Planned categories get the full plan-vs-actual treatment; everything else
  // (incl. fixed costs like rent) is summarized in one collapsible line
  const plannedRows = planRows.filter(r => r.planned > 0 || r.category === editingPlan)
  const unplannedRows = planRows.filter(r => !(r.planned > 0) && r.category !== editingPlan)
  const unplannedTotal = unplannedRows.reduce((s, r) => s + r.spent, 0)
  const unplannedOpen = showUnplanned || plannedRows.length === 0
  const unplannedCats = [...EXPENSE_CATS].filter(c => !planRows.some(r => r.category === c))

  // ── Transactions ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState<{ income: boolean; fixed: boolean }>({ income: false, fixed: false })
  const q = search.trim().toLowerCase()
  const matches = (desc: string, cat: string) =>
    (!q || desc.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) && (!filterCat || cat === filterCat)

  const monthEntries = budget.filter(b => b.month === viewMonth && b.year === viewYear && matches(b.description, b.category))
  const incomeEntries = filterCat ? [] : monthEntries.filter(b => b.type === 'income')
  const fixedEntries = monthEntries.filter(b => b.type === 'expense' && b.recurring)
  const fixedBills: BillItem[] = plan.billItems.filter(i => matches(i.bill.name, i.category))
  const variableEntries = monthEntries.filter(b => b.type === 'expense' && !b.recurring)

  const incomeTotal = incomeEntries.reduce((s, b) => s + b.amount, 0)
  const fixedTotal = fixedEntries.reduce((s, b) => s + b.amount, 0) + fixedBills.reduce((s, i) => s + i.amount, 0)

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
            <p className="text-xs text-gray-500 mt-2">
              {formatCurrency(plan.income)} income − {formatCurrency(plan.fixedExpenses)} fixed − {formatCurrency(plan.variableExpenses)} spent
              {plan.savingsReserve > 0 && ` − ${formatCurrency(plan.savingsReserve)} savings to set aside`}
            </p>

            {/* 50/30/20 reference — one bar, as a guide not a rule */}
            {splitBase > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500" style={{ width: `${(plan.split.needs / splitBase) * 100}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${(plan.split.wants / splitBase) * 100}%` }} />
                  <div className="h-full bg-emerald-500" style={{ width: `${(plan.split.savings / splitBase) * 100}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" />Needs {pctOf(plan.split.needs)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Wants {pctOf(plan.split.wants)}%</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Savings {pctOf(plan.split.savings)}%</span>
                  <span className="text-gray-600 ml-auto" title="A common guide: 50% needs, 30% wants, 20% savings">guide 50 / 30 / 20</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Log form ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setLogType(t); setRecurring(t === 'income') }}
                className={`px-3 py-1.5 font-medium transition-colors ${logType === t
                  ? t === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  : 'text-gray-400 hover:text-white'}`}
              >
                {t === 'expense' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>
          {logType === 'expense' && customCategories.length > 0 && (
            <button type="button" onClick={() => setManageCats(v => !v)} className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
              {manageCats ? <><Check size={12} /> Done</> : <><Pencil size={11} /> Edit categories</>}
            </button>
          )}
        </div>

        <div className="text-2xl font-bold">
          <MoneyInput
            inputRef={amountRef}
            aria-label="Amount"
            value={amount}
            onChange={v => { setAmount(v); setFormError('') }}
            onEnter={handleLog}
            className="!rounded-xl !py-3 text-2xl font-bold"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {pickerCats.map(c => {
            const selected = c === activeCat
            return (
              <div key={c} className="relative">
                <button
                  type="button"
                  onClick={() => setChosen(c)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                    selected ? 'text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                  }`}
                  style={selected ? { backgroundColor: catColor(c) + '40', borderColor: catColor(c) } : undefined}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(c) }} />
                  {c}
                </button>
                {manageCats && logType === 'expense' && customCategories.includes(c) && (
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
          {logType === 'expense' && (addingCat ? (
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
              <button type="button" onClick={handleAddCategory} className="p-1.5 text-emerald-400"><Check size={16} /></button>
              <button type="button" onClick={() => { setAddingCat(false); setNewCat('') }} className="p-1.5 text-gray-500"><X size={16} /></button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCat(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
            >
              <Plus size={13} /> New
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Note (optional)"
            aria-label="Note"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLog() }}
            className={`${inputCls} flex-1 min-w-0 px-3 py-2.5 text-sm`}
            style={{ fontSize: '16px' }}
          />
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={`${inputCls} w-[9.5rem] min-w-0 shrink-0 px-2 py-2.5 text-sm`}
            style={{ fontSize: '16px', colorScheme: 'dark' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Toggle on={recurring} onClick={() => setRecurring(r => !r)} />
          <p className="text-xs text-gray-400 flex-1">
            <span className="text-gray-200 font-medium">Repeats monthly</span>
            {logType === 'expense' && ' — counts as a fixed expense'}
          </p>
        </div>

        {formError && <p className="text-xs text-rose-400">{formError}</p>}

        <button
          type="button"
          onClick={handleLog}
          className={`w-full py-3 text-white font-semibold rounded-xl transition-colors ${logType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-brand-600 hover:bg-brand-500'}`}
        >
          {logType === 'income' ? 'Add' : 'Log'} {parseAmount(amount) > 0 ? formatCurrency(parseAmount(amount)) : logType === 'income' ? 'income' : 'expense'} · {activeCat}
        </button>
      </div>

      {/* ── Categories: plan vs actual ────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white flex-1">Categories</h3>
          <span className="text-xs text-gray-500">spent / planned</span>
        </div>
        {plannedRows.length === 0 && unplannedRows.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-500 text-center">No spending yet this month.</p>
        )}

        {/* Planned categories: spent vs plan, "cover it" when over */}
        <div className="divide-y divide-gray-800/60">
          {plannedRows.map(row => {
            const { category, spent, planned, remaining } = row
            const isSavings = category === SAVINGS_CATEGORY
            const over = !isSavings && planned > 0 && remaining < 0
            const donor = over ? coverSource(planRows, category) : null
            const coverAmt = donor ? Math.min(-remaining, donor.remaining) : 0
            const pct = planned > 0 ? spent / planned : 0
            const barColor = isSavings ? 'bg-emerald-500' : pct >= 1 ? 'bg-rose-500' : pct >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div key={category} className={`px-4 py-3 sm:px-5 ${filterCat === category ? 'bg-gray-800/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFilterCat(f => (f === category ? null : category))} className="flex-1 min-w-0 text-left" title="Show these transactions">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-white flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(category) }} />
                        {catLabel(category)}
                      </span>
                      <span className="text-sm shrink-0">
                        <span className="font-semibold text-white">{formatCurrency(spent)}</span>
                        {planned > 0 && <span className="text-gray-500"> / {formatCurrency(planned)}</span>}
                      </span>
                    </div>
                    {planned > 0 && (
                      <>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                        </div>
                        <p className={`text-xs mt-1 ${over ? 'text-rose-400' : isSavings && remaining <= 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {isSavings
                            ? remaining <= 0
                              ? `Goal met${remaining < 0 ? ` · ${formatCurrency(-remaining)} extra saved` : ''}`
                              : `${formatCurrency(remaining)} still to set aside`
                            : over ? `Over by ${formatCurrency(-remaining)}` : `${formatCurrency(remaining)} left`}
                        </p>
                      </>
                    )}
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
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
              style={{ fontSize: '16px', colorScheme: 'dark' }}
            >
              <option value="">+ Plan a category…</option>
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

        {incomeEntries.length === 0 && fixedEntries.length === 0 && fixedBills.length === 0 && dayGroups.length === 0 ? (
          <p className="text-center text-gray-500 py-10 text-sm px-6">
            {q || filterCat ? 'Nothing matches.' : `Nothing logged for ${monthTitle} yet.`}
          </p>
        ) : (
          <div>
            {incomeEntries.length > 0 && (
              <div>
                {groupHeader('Income', incomeEntries.length, incomeTotal, '+', forceOpen || openGroups.income,
                  forceOpen ? undefined : () => setOpenGroups(g => ({ ...g, income: !g.income })))}
                {(forceOpen || openGroups.income) && <div className="divide-y divide-gray-800/60">{incomeEntries.map(entryRow)}</div>}
              </div>
            )}

            {(fixedEntries.length > 0 || fixedBills.length > 0) && (
              <div>
                {groupHeader('Fixed — bills & monthly', fixedEntries.length + fixedBills.length, fixedTotal, '-', forceOpen || openGroups.fixed,
                  forceOpen ? undefined : () => setOpenGroups(g => ({ ...g, fixed: !g.fixed })))}
                {(forceOpen || openGroups.fixed) && (
                  <div className="divide-y divide-gray-800/60">
                    {fixedEntries.map(entryRow)}
                    {fixedBills.map(({ bill, category, amount: amt }) => (
                      <div key={bill.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor(category) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate flex items-center gap-1.5">
                            {bill.name}
                            <span className="text-[10px] text-sky-400 border border-sky-400/30 rounded px-1 shrink-0 flex items-center gap-0.5"><Receipt size={9} />bill</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {category}{bill.frequency !== 'monthly' && ` · ${formatCurrency(bill.amount)} ${bill.frequency}, set aside monthly`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-rose-400 shrink-0">-{formatCurrency(amt)}</span>
                      </div>
                    ))}
                  </div>
                )}
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
