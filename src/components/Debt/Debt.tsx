import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, calcDebtPayoff, debtAvalancheOrder, debtSnowballOrder } from '../../utils/finance'
import { addDebt, removeDebt, updateDebt } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Plus, Trash2, Edit2, CreditCard, TrendingDown } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Debt } from '../../types'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
}

const DEBT_TYPES = ['credit_card', 'loan', 'mortgage', 'student_loan', 'auto', 'other'] as const

const typeLabels: Record<string, string> = {
  credit_card: 'Credit Card',
  loan: 'Personal Loan',
  mortgage: 'Mortgage',
  student_loan: 'Student Loan',
  auto: 'Auto Loan',
  other: 'Other',
}

const typeColors: Record<string, string> = {
  credit_card: 'red',
  loan: 'yellow',
  mortgage: 'blue',
  student_loan: 'purple',
  auto: 'green',
  other: 'gray',
}

const emptyForm = {
  name: '', type: 'credit_card' as Debt['type'],
  balance: '', originalBalance: '', interestRate: '', minimumPayment: '',
}

export function DebtTracker() {
  const { debts } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editDebt, setEditDebt] = useState<Debt | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [extraPayment, setExtraPayment] = useState(200)
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche')

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0)

  const handleAdd = () => {
    const debt: Debt = {
      id: uuid(),
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      originalBalance: parseFloat(form.originalBalance) || parseFloat(form.balance) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      minimumPayment: parseFloat(form.minimumPayment) || 0,
      addedAt: new Date().toISOString(),
    }
    addDebt(debt)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editDebt) return
    updateDebt(editDebt.id, {
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      originalBalance: parseFloat(form.originalBalance) || 0,
      interestRate: parseFloat(form.interestRate) || 0,
      minimumPayment: parseFloat(form.minimumPayment) || 0,
    })
    setEditDebt(null)
  }

  const openEdit = (debt: Debt) => {
    setEditDebt(debt)
    setForm({
      name: debt.name,
      type: debt.type,
      balance: String(debt.balance),
      originalBalance: String(debt.originalBalance),
      interestRate: String(debt.interestRate),
      minimumPayment: String(debt.minimumPayment),
    })
  }

  // Payoff strategies
  const orderedDebts = strategy === 'avalanche' ? debtAvalancheOrder(debts) : debtSnowballOrder(debts)
  const totalPayment = totalMin + extraPayment

  // Payoff timeline for all debts combined (simplified: pay minimums on all, extra to priority)
  const payoffComparison = (() => {
    const avDebts = debtAvalancheOrder(debts).map(d => ({ ...d }))
    const sbDebts = debtSnowballOrder(debts).map(d => ({ ...d }))

    let avMonths = 0, avInterest = 0
    let avRemaining = avDebts.map(d => ({ ...d }))
    while (avRemaining.some(d => d.balance > 0.01) && avMonths < 600) {
      avMonths++
      let extra = extraPayment
      for (const d of avRemaining) {
        if (d.balance <= 0) continue
        const interest = d.balance * (d.interestRate / 100 / 12)
        avInterest += interest
        const pay = Math.min(d.balance + interest, d.minimumPayment + (avRemaining[0].id === d.id ? extra : 0))
        d.balance = Math.max(0, d.balance + interest - pay)
        if (d.balance < 0.01 && avRemaining[0].id === d.id) extra += d.minimumPayment
      }
    }

    let sbMonths = 0, sbInterest = 0
    let sbRemaining = sbDebts.map(d => ({ ...d }))
    while (sbRemaining.some(d => d.balance > 0.01) && sbMonths < 600) {
      sbMonths++
      let extra = extraPayment
      for (const d of sbRemaining) {
        if (d.balance <= 0) continue
        const interest = d.balance * (d.interestRate / 100 / 12)
        sbInterest += interest
        const pay = Math.min(d.balance + interest, d.minimumPayment + (sbRemaining[0].id === d.id ? extra : 0))
        d.balance = Math.max(0, d.balance + interest - pay)
        if (d.balance < 0.01 && sbRemaining[0].id === d.id) extra += d.minimumPayment
      }
    }

    return {
      avalanche: { months: avMonths, interest: Math.round(avInterest) },
      snowball: { months: sbMonths, interest: Math.round(sbInterest) },
    }
  })()

  // Individual payoff chart for selected debt (first in order)
  const primaryDebt = orderedDebts[0]
  const payoffData = primaryDebt
    ? calcDebtPayoff(primaryDebt.balance, primaryDebt.interestRate, primaryDebt.minimumPayment + extraPayment)
        .schedule.filter((_, i) => i % 3 === 0 || i === 0)
        .map(s => ({ month: s.month, balance: s.balance }))
    : []

  const debtFormJsx = (
    <div className="space-y-4">
      <FormField label="Debt Name">
        <Input placeholder="Chase Sapphire, Car Loan…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </FormField>
      <FormField label="Type">
        <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Debt['type'] }))}>
          {DEBT_TYPES.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Current Balance ($)">
          <Input type="number" placeholder="0.00" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
        </FormField>
        <FormField label="Original Balance ($)">
          <Input type="number" placeholder="0.00" value={form.originalBalance} onChange={e => setForm(f => ({ ...f, originalBalance: e.target.value }))} />
        </FormField>
        <FormField label="Interest Rate (%)">
          <Input type="number" placeholder="0.00" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
        </FormField>
        <FormField label="Min. Monthly Payment ($)">
          <Input type="number" placeholder="0.00" value={form.minimumPayment} onChange={e => setForm(f => ({ ...f, minimumPayment: e.target.value }))} />
        </FormField>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <Card>
          <p className="text-sm text-gray-400">Total Debt</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(totalDebt)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Min. Payments/mo</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalMin)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Accounts</p>
          <p className="text-2xl font-bold text-white mt-1">{debts.length}</p>
        </Card>
      </div>

      {/* Debt list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Debts</h3>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}><Plus size={14} /> Add Debt</Button>
        </div>
        <div className="divide-y divide-gray-800">
          {debts.map(debt => {
            const paidPct = debt.originalBalance > 0 ? ((debt.originalBalance - debt.balance) / debt.originalBalance) * 100 : 0
            return (
              <div key={debt.id} className="flex items-start gap-3 px-4 py-4 sm:px-5 sm:gap-4">
                <div className="p-2.5 bg-gray-800 rounded-xl shrink-0">
                  <CreditCard size={18} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-white">{debt.name}</p>
                    <Badge color={typeColors[debt.type] as 'red'}>{typeLabels[debt.type]}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-400">
                    <span>{debt.interestRate}% APR</span>
                    <span>Min: {formatCurrency(debt.minimumPayment)}/mo</span>
                    <span className="text-gray-500">{paidPct.toFixed(0)}% paid off</span>
                  </div>
                  {/* Balance shown below name on mobile */}
                  <div className="mt-1.5 sm:hidden">
                    <p className="font-bold text-rose-400">{formatCurrency(debt.balance)}</p>
                    <p className="text-xs text-gray-500">of {formatCurrency(debt.originalBalance)}</p>
                  </div>
                </div>
                {/* Balance on right side for desktop */}
                <div className="hidden sm:block text-right shrink-0">
                  <p className="font-bold text-rose-400">{formatCurrency(debt.balance)}</p>
                  <p className="text-xs text-gray-500">of {formatCurrency(debt.originalBalance)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(debt)} className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-700 rounded-lg cursor-pointer">
                    <Edit2 size={14} />
                  </button>
                  <button type="button" onClick={() => removeDebt(debt.id)} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {debts.length === 0 && <p className="text-center text-gray-500 py-10">No debts tracked. Add your first debt.</p>}
        </div>
      </div>

      {/* Payoff Calculator */}
      {debts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Payoff Calculator</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField label={`Extra Monthly Payment: ${formatCurrency(extraPayment)}`}>
                <input
                  type="range" min={0} max={2000} step={50} value={extraPayment}
                  onChange={e => setExtraPayment(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStrategy('avalanche')}
                  className={`p-3 rounded-xl text-left transition-all border ${strategy === 'avalanche' ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-600'}`}
                >
                  <p className="font-medium text-white text-sm">Avalanche</p>
                  <p className="text-xs text-gray-400 mt-0.5">Pay highest rate first</p>
                  <p className="text-xs text-emerald-400 mt-1">{payoffComparison.avalanche.months}mo · saves {formatCurrency(Math.max(0, payoffComparison.snowball.interest - payoffComparison.avalanche.interest), true)} interest</p>
                </button>
                <button
                  type="button"
                  onClick={() => setStrategy('snowball')}
                  className={`p-3 rounded-xl text-left transition-all border ${strategy === 'snowball' ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-600'}`}
                >
                  <p className="font-medium text-white text-sm">Snowball</p>
                  <p className="text-xs text-gray-400 mt-0.5">Pay smallest balance first</p>
                  <p className="text-xs text-sky-400 mt-1">{payoffComparison.snowball.months}mo · motivating wins</p>
                </button>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium">Priority Order ({strategy})</p>
                {orderedDebts.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center text-xs text-white font-bold">{i + 1}</span>
                    <span className="text-white">{d.name}</span>
                    <span className="text-gray-500 ml-auto">{d.interestRate}% APR</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2">
                {primaryDebt?.name} payoff timeline (extra {formatCurrency(extraPayment)}/mo applied)
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={payoffData}>
                  <defs>
                    <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'months', fill: '#6b7280', fontSize: 10, position: 'insideBottom', offset: 0 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Balance']} />
                  <Area type="monotone" dataKey="balance" stroke="#f43f5e" strokeWidth={2} fill="url(#debtGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Debt"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Debt</Button></div>}
      >{debtFormJsx}</Modal>
      <Modal
        open={!!editDebt}
        onClose={() => { setEditDebt(null); setForm({ ...emptyForm }) }}
        title="Edit Debt"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditDebt(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save Changes</Button></div>}
      >{debtFormJsx}</Modal>
    </div>
  )
}
