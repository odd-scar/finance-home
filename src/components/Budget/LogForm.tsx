import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Pencil, Plus, X, PiggyBank } from 'lucide-react'
import { useAppStore } from '../../hooks/useAppStore'
import { addBudgetEntry, removeBudgetEntry, addCustomCategory, removeCustomCategory } from '../../store/store'
import { formatCurrency, parseLocalDate } from '../../lib/finance'
import { parseAmount } from '../../lib/mathExpr'
import { monthPlan, SAVINGS_CATEGORY, isFixedCategory } from '../../lib/budgetMath'
import { INCOME_CATS, VARIABLE_CATS, catColor, todayISO } from '../../lib/categories'
import { MoneyInput } from '../ui/MoneyInput'
import { v4 as uuid } from 'uuid'
import type { BudgetEntry } from '../../types'

const LAST_CAT_KEY = 'finance-home-last-spend-category'
const LAST_SAVINGS_KEY = 'finance-home-last-savings-target'

const inputCls =
  'bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors'

const catLabel = (c: string) => (c === SAVINGS_CATEGORY ? 'Savings' : c)

/** Default date for a new entry: today in the current month, otherwise the 1st of that month */
export const defaultDateFor = (month: number, year: number) => {
  const now = new Date()
  return now.getMonth() + 1 === month && now.getFullYear() === year
    ? todayISO()
    : `${year}-${String(month).padStart(2, '0')}-01`
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

interface LogFormProps {
  /** Month the new entry defaults to (Budget passes the month being viewed) */
  month?: number
  year?: number
  /** Called after an entry is saved — e.g. Budget jumps to that entry's month */
  onLogged?: (entry: BudgetEntry) => void
  /** Ask the form to switch to Expense or Income (the `n` makes repeat requests work) */
  typeRequest?: { type: 'expense' | 'income'; n: number }
  autoFocus?: boolean
  /** 'card' inside Budget; 'plain' inside a sheet that already has its own frame */
  variant?: 'card' | 'plain'
}

/**
 * The quick way to record money in or out — used on the Budget tab and from the
 * "+" button anywhere in the app. Logged expenses add up in their category, so the
 * user sees right away how much is left of that category's plan.
 */
export function LogForm({ month, year, onLogged, typeRequest, autoFocus, variant = 'card' }: LogFormProps) {
  const { budget, bills, categoryLimits, customCategories, savings, goals } = useAppStore()
  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()

  const [logType, setLogType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [expenseCat, setExpenseCat] = useState(() => {
    try { return localStorage.getItem(LAST_CAT_KEY) || 'Groceries' } catch { return 'Groceries' }
  })
  const [incomeCat, setIncomeCat] = useState('Salary')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => defaultDateFor(m, y))
  const [recurring, setRecurring] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [manageCats, setManageCats] = useState(false)
  const [formError, setFormError] = useState('')
  const [savingsTarget, setSavingsTarget] = useState<{ accountId: string; goalId: string }>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_SAVINGS_KEY) || '') } catch { return { accountId: '', goalId: '' } }
  })
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDate(defaultDateFor(m, y)) }, [m, y])
  useEffect(() => {
    if (!typeRequest) return
    setLogType(typeRequest.type)
    setRecurring(typeRequest.type === 'income')
    amountRef.current?.focus()
  }, [typeRequest?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // Spending status for the month the entry will land in
  const entryDay = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : defaultDateFor(m, y)
  const entryDate = parseLocalDate(entryDay)
  const plan = monthPlan(budget, bills, categoryLimits, entryDate.getMonth() + 1, entryDate.getFullYear())
  const rowFor = (c: string) => plan.rows.find(r => r.category === c)

  // Expense chips: planned categories first, then everyday ones, your own, and Savings last
  const planned = Object.keys(categoryLimits).filter(c => categoryLimits[c] > 0 && c !== SAVINGS_CATEGORY && !isFixedCategory(c))
  const expenseChips = [...new Set([
    ...planned,
    ...VARIABLE_CATS,
    ...customCategories.filter(c => !VARIABLE_CATS.some(v => v.toLowerCase() === c.toLowerCase())),
    SAVINGS_CATEGORY,
  ])]
  const pickerCats = logType === 'income' ? INCOME_CATS : expenseChips
  const chosen = logType === 'income' ? incomeCat : expenseCat
  const activeCat = pickerCats.includes(chosen) ? chosen : pickerCats[0]
  const isSavings = logType === 'expense' && activeCat === SAVINGS_CATEGORY
  const setChosen = (c: string) => (logType === 'income' ? setIncomeCat(c) : setExpenseCat(c))

  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)
  const accountId = savings.some(a => a.id === savingsTarget.accountId) ? savingsTarget.accountId : ''
  const goalId = activeGoals.some(g => g.id === savingsTarget.goalId) ? savingsTarget.goalId : ''

  // ── Toast (logged, with undo) ────────────────────────────────────────
  const [toast, setToast] = useState<{ entry: BudgetEntry; status: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const handleLog = () => {
    const amt = parseAmount(amount)
    if (!(amt > 0)) { setFormError('Enter an amount.'); amountRef.current?.focus(); return }
    const entry: BudgetEntry = {
      id: uuid(),
      month: entryDate.getMonth() + 1,
      year: entryDate.getFullYear(),
      category: activeCat,
      description: note.trim() || catLabel(activeCat),
      amount: Math.round(amt * 100) / 100,
      type: logType,
      recurring,
      date: entryDay,
      addedAt: new Date().toISOString(),
      ...(isSavings && accountId ? { savingsAccountId: accountId } : {}),
      ...(isSavings && goalId ? { goalId } : {}),
    }

    // What's left in this category after this entry (for the confirmation)
    let status = ''
    if (logType === 'expense') {
      const row = rowFor(activeCat)
      const plannedAmt = categoryLimits[activeCat] ?? 0
      const spentAfter = (row?.spent ?? 0) + (recurring && !isSavings ? 0 : entry.amount)
      if (plannedAmt > 0) {
        const left = plannedAmt - spentAfter
        status = isSavings
          ? left > 0 ? `${formatCurrency(left)} to go this month` : 'savings goal for the month met'
          : left >= 0 ? `${formatCurrency(left)} left this month` : `${formatCurrency(-left)} over plan`
      }
      try { localStorage.setItem(LAST_CAT_KEY, activeCat) } catch { /* quota */ }
      if (isSavings) {
        try { localStorage.setItem(LAST_SAVINGS_KEY, JSON.stringify({ accountId, goalId })) } catch { /* quota */ }
      }
    }

    addBudgetEntry(entry)
    setToast({ entry, status })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
    onLogged?.(entry)
    // Ready for the next one: keep type/category/date, clear amount + note
    setAmount('')
    setNote('')
    setFormError('')
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

  // One line under the chips: how this category is doing this month
  const selectedRow = logType === 'expense' ? rowFor(activeCat) : undefined
  const selectedPlan = logType === 'expense' ? categoryLimits[activeCat] ?? 0 : 0
  const spentSoFar = selectedRow?.spent ?? 0

  return (
    <div className={variant === 'card' ? 'bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3' : 'space-y-3'}>
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
          <button type="button" onClick={() => setManageCats(v => !v)} className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 py-2">
            {manageCats ? <><Check size={12} /> Done</> : <><Pencil size={11} /> Edit categories</>}
          </button>
        )}
      </div>

      <div className="text-2xl font-bold">
        <MoneyInput
          inputRef={amountRef}
          aria-label="Amount"
          autoFocus={autoFocus}
          value={amount}
          onChange={v => { setAmount(v); setFormError('') }}
          onEnter={handleLog}
          className="!rounded-xl !py-3 text-2xl font-bold"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {pickerCats.map(c => {
          const selected = c === activeCat
          const isPlanned = logType === 'expense' && (categoryLimits[c] ?? 0) > 0
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
                {c === SAVINGS_CATEGORY
                  ? <PiggyBank size={13} className="text-emerald-400 shrink-0" />
                  : <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor(c) }} />}
                {catLabel(c)}
                {isPlanned && !selected && <span className="w-1 h-1 rounded-full bg-brand-400" title="Has a plan" />}
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

      {/* How the selected category is doing this month */}
      {logType === 'expense' && !isSavings && (
        <p className="text-xs text-gray-400">
          <span className="text-gray-200 font-medium">{catLabel(activeCat)}</span> this month: {formatCurrency(spentSoFar)} spent
          {selectedPlan > 0
            ? spentSoFar <= selectedPlan
              ? <> · <span className="text-emerald-400">{formatCurrency(selectedPlan - spentSoFar)} left</span> of {formatCurrency(selectedPlan)}</>
              : <> · <span className="text-rose-400">{formatCurrency(spentSoFar - selectedPlan)} over</span> the {formatCurrency(selectedPlan)} plan</>
            : <span className="text-gray-500"> · no plan set</span>}
        </p>
      )}

      {/* Savings: optionally move the money into an account and/or count it toward a goal */}
      {isSavings && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs text-gray-400">
            Into account <span className="text-gray-600">(optional)</span>
            <select
              value={accountId}
              onChange={e => setSavingsTarget(t => ({ ...t, accountId: e.target.value }))}
              className={`${inputCls} w-full mt-1 px-3 py-2.5 text-sm`}
              style={{ fontSize: '16px', colorScheme: 'dark' }}
            >
              <option value="">Don’t change an account</option>
              {savings.map(a => <option key={a.id} value={a.id}>{a.name} · {formatCurrency(a.balance)}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400">
            Toward goal <span className="text-gray-600">(optional)</span>
            <select
              value={goalId}
              onChange={e => setSavingsTarget(t => ({ ...t, goalId: e.target.value }))}
              className={`${inputCls} w-full mt-1 px-3 py-2.5 text-sm`}
              style={{ fontSize: '16px', colorScheme: 'dark' }}
            >
              <option value="">No goal</option>
              {activeGoals.map(g => <option key={g.id} value={g.id}>{g.name} · {formatCurrency(g.currentAmount)} of {formatCurrency(g.targetAmount)}</option>)}
            </select>
          </label>
        </div>
      )}

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
          className={`${inputCls} !w-[9.5rem] shrink-0 px-2 py-2.5 text-sm`}
          style={{ fontSize: '16px', colorScheme: 'dark' }}
        />
      </div>

      <div className="flex items-center gap-3">
        <Toggle on={recurring} onClick={() => setRecurring(r => !r)} />
        <p className="text-xs text-gray-400 flex-1">
          <span className="text-gray-200 font-medium">Repeats monthly</span>
          {logType === 'expense' && !isSavings && ' — makes it a fixed expense (like a bill)'}
        </p>
      </div>

      {formError && <p className="text-xs text-rose-400">{formError}</p>}

      <button
        type="button"
        onClick={handleLog}
        className={`w-full py-3 text-white font-semibold rounded-xl transition-colors ${
          logType === 'income' || isSavings ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-brand-600 hover:bg-brand-500'
        }`}
      >
        {logType === 'income' ? 'Add' : isSavings ? 'Save' : 'Log'}{' '}
        {parseAmount(amount) > 0 ? formatCurrency(parseAmount(amount)) : logType === 'income' ? 'income' : isSavings ? 'to savings' : 'expense'}
        {!isSavings && ` · ${catLabel(activeCat)}`}
      </button>

      {/* Portaled to <body> so it sits at the bottom of the screen even inside a sheet */}
      {toast && createPortal(
        <div className="fixed bottom-32 lg:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-gray-800 border border-gray-700 text-sm px-4 py-3 rounded-2xl shadow-2xl animate-slide-up max-w-[calc(100vw-2rem)]">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span className="text-gray-300 min-w-0">
            {toast.entry.type === 'income' ? 'Added' : toast.entry.category === SAVINGS_CATEGORY ? 'Saved' : 'Logged'}{' '}
            <span className="text-white font-medium">{formatCurrency(toast.entry.amount)}</span> · {catLabel(toast.entry.category)}
            {toast.status && <span className="block text-xs text-gray-400">{toast.status}</span>}
          </span>
          <button
            type="button"
            onClick={() => { removeBudgetEntry(toast.entry.id); setToast(null) }}
            className="ml-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shrink-0"
          >
            Undo
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
