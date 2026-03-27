import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, daysUntil, formatDate, monthlySavingsNeeded } from '../../utils/finance'
import { addGoal, removeGoal, updateGoal } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { ProgressBar } from '../ui/ProgressBar'
import { Badge } from '../ui/Badge'
import { Plus, Trash2, Edit2, Target, Calendar, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { FinancialGoal } from '../../types'

const CATEGORIES = ['savings', 'debt_payoff', 'investment', 'purchase', 'other'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

const catLabels: Record<string, string> = {
  savings: 'Savings', debt_payoff: 'Debt Payoff', investment: 'Investment',
  purchase: 'Purchase', other: 'Other',
}
const priorityColor: Record<string, string> = { high: 'red', medium: 'yellow', low: 'green' }

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#ec4899', '#14b8a6']

const emptyForm = {
  name: '', targetAmount: '', currentAmount: '', targetDate: '',
  priority: 'medium' as FinancialGoal['priority'],
  category: 'savings' as FinancialGoal['category'],
  color: PALETTE[0],
}

export function Goals() {
  const { goals } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<FinancialGoal | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount)
  const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount)

  const sorted = [...activeGoals].sort((a, b) => {
    const po = { high: 0, medium: 1, low: 2 }
    return po[a.priority] - po[b.priority]
  })

  const handleAdd = () => {
    const goal: FinancialGoal = {
      id: uuid(),
      name: form.name,
      targetAmount: parseFloat(form.targetAmount) || 0,
      currentAmount: parseFloat(form.currentAmount) || 0,
      targetDate: form.targetDate,
      priority: form.priority,
      category: form.category,
      color: form.color,
      addedAt: new Date().toISOString(),
    }
    addGoal(goal)
    setForm({ ...emptyForm })
    setAddOpen(false)
  }

  const handleEdit = () => {
    if (!editGoal) return
    updateGoal(editGoal.id, {
      name: form.name,
      targetAmount: parseFloat(form.targetAmount) || 0,
      currentAmount: parseFloat(form.currentAmount) || 0,
      targetDate: form.targetDate,
      priority: form.priority,
      category: form.category,
      color: form.color,
    })
    setEditGoal(null)
  }

  const openEdit = (g: FinancialGoal) => {
    setEditGoal(g)
    setForm({
      name: g.name, targetAmount: String(g.targetAmount), currentAmount: String(g.currentAmount),
      targetDate: g.targetDate, priority: g.priority, category: g.category, color: g.color,
    })
  }

  const goalFormJsx = (
    <div className="space-y-4">
      <FormField label="Goal Name">
        <Input placeholder="Emergency Fund, New Car…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Target Amount ($)">
          <Input type="number" placeholder="10000" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
        </FormField>
        <FormField label="Current Amount ($)">
          <Input type="number" placeholder="0" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
        </FormField>
        <FormField label="Target Date">
          <Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
        </FormField>
        <FormField label="Category">
          <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as FinancialGoal['category'] }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{catLabels[c]}</option>)}
          </Select>
        </FormField>
        <FormField label="Priority">
          <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as FinancialGoal['priority'] }))}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </FormField>
        <FormField label="Color">
          <div className="flex flex-wrap gap-2 mt-1">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </FormField>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 lg:gap-4 flex-1 mr-3 sm:mr-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 truncate">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{goals.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 truncate">Done</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">{completedGoals.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400 truncate">Active</p>
            <p className="text-xl sm:text-2xl font-bold text-brand-400">{activeGoals.length}</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm }); setAddOpen(true) }}><Plus size={14} /> New Goal</Button>
      </div>

      {/* Active Goals grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map(goal => {
          const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
          const remaining = goal.targetAmount - goal.currentAmount
          const days = goal.targetDate ? daysUntil(goal.targetDate) : null
          const monthly = goal.targetDate
            ? monthlySavingsNeeded(goal.targetAmount, goal.currentAmount, goal.targetDate)
            : null
          const overdue = days !== null && days < 0

          return (
            <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: goal.color + '25' }}>
                    <Target size={18} style={{ color: goal.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{goal.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color={priorityColor[goal.priority] as 'red'}>{goal.priority}</Badge>
                      <span className="text-xs text-gray-500">{catLabels[goal.category]}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openEdit(goal)} className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-700 rounded-lg cursor-pointer">
                    <Edit2 size={13} />
                  </button>
                  <button type="button" onClick={() => removeGoal(goal.id)} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white font-medium">{formatCurrency(goal.currentAmount)}</span>
                  <span className="text-gray-400">of {formatCurrency(goal.targetAmount)}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: goal.color }}
                  />
                </div>
                <p className="text-xs text-right mt-1" style={{ color: goal.color }}>{pct.toFixed(0)}% complete</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Still needed</p>
                  <p className="text-sm font-semibold text-white">{formatCurrency(remaining)}</p>
                </div>
                {monthly !== null && (
                  <div className={`rounded-lg p-2 text-center ${overdue ? 'bg-rose-500/15' : 'bg-gray-800'}`}>
                    <p className="text-xs text-gray-500">Save/month</p>
                    <p className={`text-sm font-semibold ${overdue ? 'text-rose-400' : 'text-white'}`}>
                      {monthly > 0 ? formatCurrency(monthly) : '—'}
                    </p>
                  </div>
                )}
              </div>

              {goal.targetDate && (
                <div className={`flex items-center gap-2 mt-3 text-xs ${overdue ? 'text-rose-400' : days && days < 30 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                  {overdue
                    ? `Overdue by ${Math.abs(days!)} days`
                    : days !== null && days < 365
                    ? `${days} days remaining (${formatDate(goal.targetDate)})`
                    : `Target: ${formatDate(goal.targetDate)}`}
                </div>
              )}
            </div>
          )
        })}
        {activeGoals.length === 0 && completedGoals.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-500">
            <Target size={40} className="mx-auto mb-3 opacity-30" />
            <p>No goals yet. Set your first financial goal!</p>
          </div>
        )}
        {activeGoals.length === 0 && completedGoals.length > 0 && (
          <div className="col-span-2 text-center py-8 text-gray-500">
            <p className="text-sm">All goals completed!</p>
          </div>
        )}
      </div>

      {/* Completed Goals Section */}
      {completedGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-emerald-400" />
            <h3 className="font-semibold text-white">Completed Goals</h3>
            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
              {completedGoals.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {completedGoals.map(goal => (
              <div key={goal.id} className="bg-gray-900 border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/20">
                      <CheckCircle size={18} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{goal.name}</p>
                        <span className="text-base">🎉</span>
                      </div>
                      <span className="text-xs text-gray-500">{catLabels[goal.category]}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openEdit(goal)} className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-700 rounded-lg cursor-pointer">
                      <Edit2 size={13} />
                    </button>
                    <button type="button" onClick={() => removeGoal(goal.id)} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-emerald-400 font-medium">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-gray-400">target: {formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-2.5 rounded-full bg-emerald-500 w-full" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 rounded-lg">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Goal achieved!</span>
                  {goal.addedAt && (
                    <span className="text-xs text-gray-500 ml-auto">
                      Added {new Date(goal.addedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ ...emptyForm }) }}
        title="New Financial Goal"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAdd} className="flex-1">Add Goal</Button></div>}
      >{goalFormJsx}</Modal>
      <Modal
        open={!!editGoal}
        onClose={() => { setEditGoal(null); setForm({ ...emptyForm }) }}
        title="Edit Goal"
        size="lg"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditGoal(null); setForm({ ...emptyForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEdit} className="flex-1">Save</Button></div>}
      >{goalFormJsx}</Modal>
    </div>
  )
}
