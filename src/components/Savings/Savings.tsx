import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, projectGrowth } from '../../utils/finance'
import { addSavings, removeSavings, updateSavings, updateSavingsNote } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { ProgressBar } from '../ui/ProgressBar'
import { Card } from '../ui/Card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Plus, Trash2, Edit2, PiggyBank, TrendingUp, StickyNote } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { SavingsAccount } from '../../types'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

const CATEGORIES = ['emergency', 'down_payment', 'vacation', 'retirement', 'education', 'general'] as const
const catLabels: Record<string, string> = {
  emergency: 'Emergency Fund', down_payment: 'Down Payment', vacation: 'Vacation',
  retirement: 'Retirement', education: 'Education', general: 'General',
}
const catColors: Record<string, string> = {
  emergency: '#6366f1', down_payment: '#0ea5e9', vacation: '#f59e0b',
  retirement: '#10b981', education: '#a855f7', general: '#6b7280',
}

const emptyForm = {
  name: '', balance: '', goalAmount: '', monthlyContribution: '',
  interestRate: '4.5', category: 'general' as SavingsAccount['category'],
}

function SavingsDetailModal({ account }: { account: SavingsAccount }) {
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const projection = projectGrowth(account.balance, account.monthlyContribution, account.interestRate, 36)
  const data = projection.filter((_, i) => i % 3 === 0 || i === projection.length - 1)
  const finalBalance = projection[projection.length - 1].balance
  const interestEarned = finalBalance - account.balance - account.monthlyContribution * 36

  const sortedHistory = [...account.history].sort((a, b) => b.month.localeCompare(a.month))

  const startEdit = (month: string, currentNote: string | undefined) => {
    setEditingNote(month)
    setNoteText(currentNote ?? '')
  }

  const saveNote = (month: string) => {
    updateSavingsNote(account.id, month, noteText)
    setEditingNote(null)
  }

  const formatMonthLabel = (m: string) => {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      {/* Projection stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400">Current</p>
          <p className="font-bold text-white">{formatCurrency(account.balance)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400">In 3 Years</p>
          <p className="font-bold text-emerald-400">{formatCurrency(finalBalance)}</p>
        </div>
        <div className="bg-emerald-500/15 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-400">Interest Earned</p>
          <p className="font-bold text-emerald-400">+{formatCurrency(Math.max(0, interestEarned))}</p>
        </div>
      </div>

      {/* Projection chart */}
      <div>
        <p className="text-xs text-gray-500 mb-2">36-Month Compound Growth Projection ({account.interestRate}% APY)</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={m => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }) }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Balance']} />
            <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fill="url(#projGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Log */}
      {sortedHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={14} className="text-brand-400" />
            <p className="text-sm font-semibold text-white">Monthly Log</p>
            <p className="text-xs text-gray-500 ml-1">— click any row to add a note</p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {sortedHistory.map((entry, i) => {
              const prev = sortedHistory[i + 1]
              const delta = prev ? entry.balance - prev.balance : null
              const isEditing = editingNote === entry.month
              return (
                <div
                  key={entry.month}
                  className={`rounded-xl border transition-colors ${
                    isEditing
                      ? 'border-brand-500/50 bg-brand-500/5'
                      : 'border-gray-800 bg-gray-800/50 hover:border-gray-700 cursor-pointer'
                  }`}
                  onClick={() => !isEditing && startEdit(entry.month, entry.note)}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* Month */}
                    <span className="text-sm font-medium text-white w-20 sm:w-24 shrink-0">
                      {formatMonthLabel(entry.month)}
                    </span>
                    {/* Balance */}
                    <span className="text-sm text-gray-300 w-20 sm:w-24 shrink-0">
                      {formatCurrency(entry.balance)}
                    </span>
                    {/* Delta */}
                    {delta !== null ? (
                      <span className={`text-xs font-medium w-16 sm:w-20 shrink-0 ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 w-16 sm:w-20 shrink-0">first entry</span>
                    )}
                    {/* Note preview or placeholder */}
                    {!isEditing && (
                      <span className={`text-xs flex-1 truncate ${entry.note ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                        {entry.note || 'Add a note…'}
                      </span>
                    )}
                    {/* Note indicator */}
                    {entry.note && !isEditing && (
                      <StickyNote size={12} className="text-amber-400 shrink-0" />
                    )}
                  </div>
                  {/* Inline note editor */}
                  {isEditing && (
                    <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
                      <textarea
                        autoFocus
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-brand-500 transition-colors"
                        rows={2}
                        placeholder="e.g. Unexpected car repair set me back $800…"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingNote(null)}
                          className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveNote(entry.month)}
                          className="text-xs bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function Savings() {
  const { savings } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<SavingsAccount | null>(null)
  const [selected, setSelected] = useState<SavingsAccount | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  // Always derive selected from the live store so detail modal stays up-to-date after edits
  const selectedAccount = selected ? savings.find(a => a.id === selected.id) ?? null : null

  const totalSavings = savings.reduce((s, a) => s + a.balance, 0)
  const totalGoal = savings.reduce((s, a) => s + (a.goalAmount ?? 0), 0)
  const totalMonthly = savings.reduce((s, a) => s + a.monthlyContribution, 0)

  const handleAdd = () => {
    const account: SavingsAccount = {
      id: uuid(),
      name: form.name,
      balance: parseFloat(form.balance) || 0,
      goalAmount: form.goalAmount ? parseFloat(form.goalAmount) : undefined,
      monthlyContribution: parseFloat(form.monthlyContribution) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      category: form.category,
      history: [],
      addedAt: new Date().toISOString(),
    }
    addSavings(account)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editAccount) return
    updateSavings(editAccount.id, {
      name: form.name,
      balance: parseFloat(form.balance) || 0,
      goalAmount: form.goalAmount ? parseFloat(form.goalAmount) : undefined,
      monthlyContribution: parseFloat(form.monthlyContribution) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      category: form.category,
    })
    setEditAccount(null)
  }

  const openEdit = (a: SavingsAccount) => {
    setEditAccount(a)
    setForm({
      name: a.name, balance: String(a.balance),
      goalAmount: a.goalAmount ? String(a.goalAmount) : '',
      monthlyContribution: String(a.monthlyContribution),
      interestRate: String(a.interestRate), category: a.category,
    })
  }

  const savingsFormJsx = (
    <div className="space-y-4">
      <FormField label="Account Name">
        <Input placeholder="Emergency Fund, House Down Payment…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </FormField>
      <FormField label="Category">
        <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as SavingsAccount['category'] }))}>
          {CATEGORIES.map(c => <option key={c} value={c}>{catLabels[c]}</option>)}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Current Balance ($)">
          <Input type="number" placeholder="0.00" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
        </FormField>
        <FormField label="Goal Amount ($)" hint="Optional">
          <Input type="number" placeholder="0.00" value={form.goalAmount} onChange={e => setForm(f => ({ ...f, goalAmount: e.target.value }))} />
        </FormField>
        <FormField label="Monthly Contribution ($)" hint="Keep in sync with Budget → Savings Transfer">
          <Input type="number" placeholder="0.00" value={form.monthlyContribution} onChange={e => setForm(f => ({ ...f, monthlyContribution: e.target.value }))} />
        </FormField>
        <FormField label="Interest Rate (% APY)">
          <Input type="number" placeholder="4.50" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
        </FormField>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <Card>
          <p className="text-sm text-gray-400">Total Saved</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalSavings)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Total Goal</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalGoal)}</p>
          {totalGoal > 0 && <ProgressBar value={totalSavings} max={totalGoal} color="bg-emerald-500" height="h-1.5" />}
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Monthly Contributions</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalMonthly)}</p>
        </Card>
      </div>

      {/* Accounts */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Savings Accounts</h3>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}><Plus size={14} /> Add Account</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5">
          {savings.map(account => {
            const color = catColors[account.category]
            const pct = account.goalAmount ? Math.min(100, (account.balance / account.goalAmount) * 100) : null
            const histData = account.history.slice(-6).map(h => ({ label: h.month.slice(5), balance: h.balance }))

            return (
              <div
                key={account.id}
                className="bg-gray-800 rounded-2xl p-4 cursor-pointer hover:bg-gray-750 transition-colors border border-gray-700 hover:border-gray-600"
                onClick={() => setSelected(account)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <p className="font-semibold text-white truncate">{account.name}</p>
                    </div>
                    <p className="text-xs text-gray-500">{catLabels[account.category]} · {account.interestRate}% APY</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={e => { e.stopPropagation(); openEdit(account) }} className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-600 rounded-lg cursor-pointer">
                      <Edit2 size={13} />
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); removeSavings(account.id) }} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-white mb-1">{formatCurrency(account.balance)}</p>
                {account.goalAmount && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Goal: {formatCurrency(account.goalAmount)}</span>
                      <span>{pct?.toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={account.balance} max={account.goalAmount} color="bg-emerald-500" height="h-1.5" />
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">+{formatCurrency(account.monthlyContribution)}/mo</p>
                  {histData.length > 0 && (
                    <div className="w-[80px] shrink-0">
                    <ResponsiveContainer width="100%" height={30}>
                      <AreaChart data={histData}>
                        <defs>
                          <linearGradient id={`sg-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={1.5} fill={`url(#sg-${account.id})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {savings.length === 0 && (
          <p className="text-center text-gray-500 py-10 pb-8">No savings accounts yet.</p>
        )}
      </div>

      {/* Add/Edit modals */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Savings Account"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Account</Button></div>}
      >{savingsFormJsx}</Modal>
      <Modal
        open={!!editAccount}
        onClose={() => { setEditAccount(null); setForm({ ...emptyForm }) }}
        title="Edit Account"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditAccount(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save</Button></div>}
      >{savingsFormJsx}</Modal>

      {/* Detail / Growth Projection Modal */}
      <Modal open={!!selectedAccount} onClose={() => setSelected(null)} title={selectedAccount?.name ?? ''} size="lg">
        {selectedAccount && <SavingsDetailModal account={selectedAccount} />}
      </Modal>
    </div>
  )
}
