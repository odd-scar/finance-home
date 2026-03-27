import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, monthLabel } from '../../utils/finance'
import { addBudgetEntry, removeBudgetEntry, updateBudgetEntry } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { Badge } from '../ui/Badge'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { BudgetEntry } from '../../types'

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

const expColors = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e',
  '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#fb923c',
  '#38bdf8', '#4ade80', '#e879f9',
]

const emptyForm = { category: 'Salary', description: '', amount: '', type: 'income' as 'income' | 'expense' }

export function Budget() {
  const { budget } = useAppStore()
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showAllCategories, setShowAllCategories] = useState(false)

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

  // Category breakdown for expenses
  const expByCategory = EXPENSE_CATS.map((cat, i) => ({
    name: cat,
    value: monthEntries.filter(b => b.type === 'expense' && b.category === cat).reduce((s, b) => s + b.amount, 0),
    color: expColors[i % expColors.length],
  })).filter(d => d.value > 0)

  const handleAdd = () => {
    const entry: BudgetEntry = {
      id: uuid(),
      month: viewMonth, year: viewYear,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      type: form.type,
      addedAt: new Date().toISOString(),
    }
    addBudgetEntry(entry)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editEntry) return
    updateBudgetEntry(editEntry.id, {
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      type: form.type,
    })
    setEditEntry(null)
  }

  const openEdit = (e: BudgetEntry) => {
    const validCats = e.type === 'income' ? INCOME_CATS : EXPENSE_CATS
    const category = validCats.includes(e.category) ? e.category : validCats[0]
    setForm({ category, description: e.description, amount: String(e.amount), type: e.type })
    setEditEntry(e)
  }

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS
  const filtered = monthEntries.filter(b => filterType === 'all' || b.type === filterType)

  const budgetFormJsx = (
    <div className="space-y-4">
      <div className="flex rounded-xl overflow-hidden border border-gray-700">
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Salary' }))}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}
        >Income</button>
        <button
          type="button"
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
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Month nav */}
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
        <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}><Plus size={14} /> Add Entry</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-400" />
            <p className="text-sm text-gray-400">Income</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(income)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-rose-400" />
            <p className="text-sm text-gray-400">Expenses</p>
          </div>
          <p className="text-2xl font-bold text-rose-400">{formatCurrency(expenses)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${net >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
          <p className="text-sm text-gray-400 mb-1">Net</p>
          <p className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </p>
        </div>
      </div>

      {/* Charts */}
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
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(v => !v)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
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

      {/* Entries table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white flex-1">Transactions</h3>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            {(['all', 'income', 'expense'] as const).map(t => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 capitalize transition-colors ${filterType === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-800 max-h-64 sm:max-h-96 overflow-y-auto">
          {filtered.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:gap-4">
              <div className={`w-2 h-2 rounded-full shrink-0 ${entry.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{entry.description || entry.category}</p>
                <p className="hidden sm:block text-xs text-gray-500">{entry.category}</p>
              </div>
              <span className={`font-semibold text-sm ${entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
              </span>
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
                  onClick={() => removeBudgetEntry(entry.id)}
                  className="p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer touch-manipulation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">No entries for this month.</p>
          )}
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Budget Entry"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Entry</Button></div>}
      >{budgetFormJsx}</Modal>
      <Modal
        open={!!editEntry}
        onClose={() => { setEditEntry(null); setForm({ ...emptyForm }) }}
        title="Edit Entry"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditEntry(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save</Button></div>}
      >{budgetFormJsx}</Modal>
    </div>
  )
}
