import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { addBill, updateBill, removeBill } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import {
  Plus, Trash2, Edit2, Home, Zap, Repeat, Shield, CreditCard, Car, Receipt,
  CalendarPlus, CheckCircle, AlertCircle, Clock,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Bill } from '../../types'

const CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'loan', 'transportation', 'other'] as const
const FREQUENCIES = ['monthly', 'quarterly', 'annual'] as const

const catLabels: Record<Bill['category'], string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  subscriptions: 'Subscriptions',
  insurance: 'Insurance',
  loan: 'Loan',
  transportation: 'Transportation',
  other: 'Other',
}

const catColors: Record<Bill['category'], string> = {
  housing: 'bg-blue-500/20 text-blue-400',
  utilities: 'bg-yellow-500/20 text-yellow-400',
  subscriptions: 'bg-purple-500/20 text-purple-400',
  insurance: 'bg-green-500/20 text-green-400',
  loan: 'bg-red-500/20 text-red-400',
  transportation: 'bg-sky-500/20 text-sky-400',
  other: 'bg-gray-500/20 text-gray-400',
}

function CatIcon({ category, size = 14 }: { category: Bill['category']; size?: number }) {
  const props = { size, className: 'shrink-0' }
  switch (category) {
    case 'housing': return <Home {...props} />
    case 'utilities': return <Zap {...props} />
    case 'subscriptions': return <Repeat {...props} />
    case 'insurance': return <Shield {...props} />
    case 'loan': return <CreditCard {...props} />
    case 'transportation': return <Car {...props} />
    default: return <Receipt {...props} />
  }
}

function buildGCalUrl(bill: Bill): string {
  const now = new Date()
  let due = new Date(now.getFullYear(), now.getMonth(), bill.dueDay)
  if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, bill.dueDay)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${due.getFullYear()}${pad(due.getMonth() + 1)}${pad(due.getDate())}`
  const rrule = bill.frequency === 'monthly' ? 'RRULE:FREQ=MONTHLY'
    : bill.frequency === 'quarterly' ? 'RRULE:FREQ=MONTHLY;INTERVAL=3'
    : 'RRULE:FREQ=YEARLY'
  const text = encodeURIComponent(`${bill.name} — $${bill.amount} due`)
  const details = encodeURIComponent(`Bill: ${bill.name}\nAmount: $${bill.amount}\nFrequency: ${bill.frequency}${bill.notes ? '\nNote: ' + bill.notes : ''}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dateStr}/${dateStr}&recur=${encodeURIComponent(rrule)}`
}

function daysUntilDue(dueDay: number): number {
  const now = new Date()
  let due = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const toMonthly = (amount: number, frequency: Bill['frequency']): number => {
  if (frequency === 'monthly') return amount
  if (frequency === 'quarterly') return amount / 3
  return amount / 12
}

const emptyForm = {
  name: '',
  amount: '',
  category: 'housing' as Bill['category'],
  dueDay: '1',
  frequency: 'monthly' as Bill['frequency'],
  autoPay: false,
  notes: '',
}

export function Bills() {
  const { bills } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editBill, setEditBill] = useState<Bill | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay)

  const totalMonthly = bills.reduce((s, b) => s + toMonthly(b.amount, b.frequency), 0)
  const totalAnnual = bills.reduce((s, b) => {
    if (b.frequency === 'monthly') return s + b.amount * 12
    if (b.frequency === 'quarterly') return s + b.amount * 4
    return s + b.amount
  }, 0)
  const autoPayCount = bills.filter(b => b.autoPay).length

  const handleAdd = () => {
    if (!form.name || !form.amount) return
    const bill: Bill = {
      id: uuid(),
      name: form.name,
      amount: parseFloat(form.amount) || 0,
      category: form.category,
      dueDay: parseInt(form.dueDay) || 1,
      frequency: form.frequency,
      autoPay: form.autoPay,
      notes: form.notes || undefined,
      addedAt: new Date().toISOString(),
    }
    addBill(bill)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editBill) return
    updateBill(editBill.id, {
      name: form.name,
      amount: parseFloat(form.amount) || 0,
      category: form.category,
      dueDay: parseInt(form.dueDay) || 1,
      frequency: form.frequency,
      autoPay: form.autoPay,
      notes: form.notes || undefined,
    })
    setEditBill(null)
  }

  const openEdit = (b: Bill) => {
    setEditBill(b)
    setForm({
      name: b.name,
      amount: String(b.amount),
      category: b.category,
      dueDay: String(b.dueDay),
      frequency: b.frequency,
      autoPay: b.autoPay,
      notes: b.notes || '',
    })
  }

  const billFormJsx = (
    <div className="space-y-4">
      <FormField label="Bill Name">
        <Input
          placeholder="Rent, Netflix, Car Insurance…"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount ($)">
          <Input
            type="number"
            placeholder="0.00"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </FormField>
        <FormField label="Due Day (1–31)">
          <Input
            type="number"
            min="1"
            max="31"
            placeholder="1"
            value={form.dueDay}
            onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))}
          />
        </FormField>
        <FormField label="Category">
          <Select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value as Bill['category'] }))}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{catLabels[c]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Frequency">
          <Select
            value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Bill['frequency'] }))}
          >
            {FREQUENCIES.map(fr => (
              <option key={fr} value={fr}>{fr.charAt(0).toUpperCase() + fr.slice(1)}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.autoPay}
          onChange={e => setForm(f => ({ ...f, autoPay: e.target.checked }))}
          className="w-4 h-4 rounded accent-brand-600"
        />
        Auto-pay enabled
      </label>
      <FormField label="Notes (optional)">
        <Input
          placeholder="Any notes about this bill…"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </FormField>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {/* Google Calendar tip */}
      <div className="flex items-start gap-3 p-4 bg-brand-600/10 border border-brand-600/30 rounded-xl">
        <CalendarPlus size={18} className="text-brand-400 shrink-0 mt-0.5" />
        <p className="text-sm text-brand-300">
          Click the calendar icon on any bill to add it to Google Calendar with recurring reminders — no extra setup needed.
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Monthly Total</p>
          <p className="text-2xl font-bold text-white">${Math.round(totalMonthly).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Annual Total</p>
          <p className="text-2xl font-bold text-white">${totalAnnual.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Bills Tracked</p>
          <p className="text-2xl font-bold text-white">{bills.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Auto-pay</p>
          <p className="text-2xl font-bold text-emerald-400">{autoPayCount}</p>
          <p className="text-xs text-gray-500">{bills.length - autoPayCount} manual</p>
        </div>
      </div>

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recurring Bills</h2>
        <Button onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}>
          <Plus size={14} /> Add Bill
        </Button>
      </div>

      {/* Bills list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
            <Receipt size={36} className="opacity-30" />
            <p className="text-sm">No bills yet. Add your first recurring bill!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sorted.map(bill => {
              const days = daysUntilDue(bill.dueDay)
              const urgentClass = days <= 2
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : days <= 6
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              const DueIcon = days <= 2 ? AlertCircle : days <= 6 ? Clock : CheckCircle

              return (
                <div key={bill.id} className="flex items-start gap-3 px-4 py-4 sm:px-5 sm:items-center sm:gap-4 hover:bg-gray-800/40 transition-colors">
                  {/* Category icon */}
                  <div className={`p-2 rounded-lg shrink-0 ${catColors[bill.category]}`}>
                    <CatIcon category={bill.category} size={16} />
                  </div>

                  {/* Name + details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white truncate">{bill.name}</p>
                      <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${catColors[bill.category]}`}>
                        {catLabels[bill.category]}
                      </span>
                      {bill.autoPay && (
                        <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                          Auto-pay
                        </span>
                      )}
                      <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">
                        {bill.frequency}
                      </span>
                    </div>
                    {/* Mobile metadata row */}
                    <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${catColors[bill.category]}`}>
                        {catLabels[bill.category]}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{bill.frequency}</span>
                      {bill.autoPay && (
                        <span className="text-xs text-emerald-400">Auto-pay</span>
                      )}
                    </div>
                    {bill.notes && (
                      <p className="hidden sm:block text-xs text-gray-500 mt-0.5 truncate">{bill.notes}</p>
                    )}
                    {/* Amount shown below name on mobile */}
                    <div className="mt-1 sm:hidden flex items-center justify-between">
                      <p className="font-semibold text-white">${bill.amount.toLocaleString()}</p>
                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${urgentClass}`}>
                        <DueIcon size={10} />
                        {days === 0 ? 'Due today' : days === 1 ? '1 day' : `${days}d`}
                      </div>
                    </div>
                  </div>

                  {/* Amount — desktop only */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="font-semibold text-white">${bill.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">due day {bill.dueDay}</p>
                  </div>

                  {/* Days until due — desktop only */}
                  <div className={`hidden sm:flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${urgentClass}`}>
                    <DueIcon size={11} />
                    {days === 0 ? 'Due today' : days === 1 ? '1 day' : `${days} days`}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={buildGCalUrl(bill)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-brand-600/20 text-gray-600 hover:text-brand-400 transition-colors"
                      title="Add to Google Calendar"
                    >
                      <CalendarPlus size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => openEdit(bill)}
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-600 hover:text-white transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBill(bill.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-600 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="Add Bill"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Bill</Button></div>}
      >{billFormJsx}</Modal>
      <Modal
        open={!!editBill}
        onClose={() => { setEditBill(null); setForm({ ...emptyForm }) }}
        title="Edit Bill"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditBill(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save Changes</Button></div>}
      >{billFormJsx}</Modal>
    </div>
  )
}
