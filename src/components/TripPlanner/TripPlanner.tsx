import { useState } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, formatDate } from '../../utils/finance'
import { addTrip, removeTrip, updateTrip, addTripExpense, updateTripExpense, removeTripExpense } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField, Select } from '../ui/FormField'
import { ProgressBar } from '../ui/ProgressBar'
import { Badge } from '../ui/Badge'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Trash2, Edit2, Plane, MapPin, Calendar, DollarSign, ChevronRight, FlaskConical } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Trip, TripExpense } from '../../types'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

const EXP_CATS = ['flights', 'hotel', 'food', 'activities', 'transport', 'shopping', 'other'] as const
const catLabels: Record<string, string> = {
  flights: 'Flights', hotel: 'Hotel', food: 'Food & Dining',
  activities: 'Activities', transport: 'Transport', shopping: 'Shopping', other: 'Other',
}
const catColors: Record<string, string> = {
  flights: '#6366f1', hotel: '#0ea5e9', food: '#10b981',
  activities: '#f59e0b', transport: '#a855f7', shopping: '#f43f5e', other: '#6b7280',
}

const emptyTripForm = { name: '', destination: '', startDate: '', endDate: '', totalBudget: '' }
const emptyExpForm = { category: 'flights' as TripExpense['category'], description: '', budgeted: '', actual: '' }

/** Inline cell that lets you click to edit a number directly */
function InlineNumber({
  value, onSave, color,
}: { value: number; onSave: (n: number) => void; color?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        className="w-24 text-right bg-gray-800 border border-brand-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(parseFloat(draft) || 0); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(parseFloat(draft) || 0); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      className={`text-sm font-medium tabular-nums hover:underline decoration-dotted underline-offset-2 cursor-text ${color ?? 'text-white'}`}
      title="Click to edit"
    >
      {formatCurrency(value)}
    </button>
  )
}

export function TripPlanner() {
  const { trips, savings } = useAppStore()
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [addTripOpen, setAddTripOpen] = useState(false)
  const [editTripData, setEditTripData] = useState<Trip | null>(null)
  const [addExpOpen, setAddExpOpen] = useState(false)
  const [editExpData, setEditExpData] = useState<TripExpense | null>(null)
  const [tripForm, setTripForm] = useState({ ...emptyTripForm })
  const [expForm, setExpForm] = useState({ ...emptyExpForm })
  const [affordCalc, setAffordCalc] = useState<string>('')
  // Scenario: per-expense hypothetical overrides { expId: amount }
  const [scenario, setScenario] = useState<Record<string, string>>({})
  const [showScenario, setShowScenario] = useState(false)

  const totalSavings = savings.reduce((s, a) => s + a.balance, 0)

  const handleAddTrip = () => {
    const trip: Trip = {
      id: uuid(), name: tripForm.name, destination: tripForm.destination,
      startDate: tripForm.startDate, endDate: tripForm.endDate,
      totalBudget: parseFloat(tripForm.totalBudget) || 0,
      expenses: [], addedAt: new Date().toISOString(),
    }
    addTrip(trip)
    setTripForm({ ...emptyTripForm })
    setAddTripOpen(false)
  }

  const handleEditTrip = () => {
    if (!editTripData) return
    updateTrip(editTripData.id, {
      name: tripForm.name, destination: tripForm.destination,
      startDate: tripForm.startDate, endDate: tripForm.endDate,
      totalBudget: parseFloat(tripForm.totalBudget) || 0,
    })
    setEditTripData(null)
  }

  const openEditTrip = (t: Trip) => {
    setEditTripData(t)
    setTripForm({ name: t.name, destination: t.destination, startDate: t.startDate, endDate: t.endDate, totalBudget: String(t.totalBudget) })
  }

  const handleAddExp = () => {
    if (!selectedTrip) return
    addTripExpense(selectedTrip.id, {
      id: uuid(), category: expForm.category, description: expForm.description,
      budgeted: parseFloat(expForm.budgeted) || 0, actual: parseFloat(expForm.actual) || 0,
    })
    setExpForm({ ...emptyExpForm })
    setAddExpOpen(false)
  }

  const handleEditExp = () => {
    if (!editExpData || !selectedTrip) return
    updateTripExpense(selectedTrip.id, editExpData.id, {
      category: expForm.category, description: expForm.description,
      budgeted: parseFloat(expForm.budgeted) || 0, actual: parseFloat(expForm.actual) || 0,
    })
    setEditExpData(null)
  }

  const openEditExp = (e: TripExpense) => {
    setEditExpData(e)
    setExpForm({ category: e.category, description: e.description, budgeted: String(e.budgeted), actual: String(e.actual) })
  }

  const getTrip = (id: string) => trips.find(t => t.id === id) ?? null

  const getPieData = (trip: Trip) =>
    EXP_CATS.map(cat => ({
      name: catLabels[cat],
      value: trip.expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.budgeted || 0), 0),
      color: catColors[cat],
    })).filter(d => d.value > 0)

  const tripFormJsx = (
    <div className="space-y-4">
      <FormField label="Trip Name"><Input placeholder="Japan 2025" value={tripForm.name} onChange={e => setTripForm(f => ({ ...f, name: e.target.value }))} /></FormField>
      <FormField label="Destination"><Input placeholder="Tokyo, Japan" value={tripForm.destination} onChange={e => setTripForm(f => ({ ...f, destination: e.target.value }))} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start Date"><Input type="date" value={tripForm.startDate} onChange={e => setTripForm(f => ({ ...f, startDate: e.target.value }))} /></FormField>
        <FormField label="End Date"><Input type="date" value={tripForm.endDate} onChange={e => setTripForm(f => ({ ...f, endDate: e.target.value }))} /></FormField>
      </div>
      <FormField label="Total Budget ($)"><Input type="number" placeholder="5000" value={tripForm.totalBudget} onChange={e => setTripForm(f => ({ ...f, totalBudget: e.target.value }))} /></FormField>
    </div>
  )

  const expFormJsx = (
    <div className="space-y-4">
      <FormField label="Category">
        <Select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value as TripExpense['category'] }))}>
          {EXP_CATS.map(c => <option key={c} value={c}>{catLabels[c]}</option>)}
        </Select>
      </FormField>
      <FormField label="Description"><Input placeholder="Round trip flights…" value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Budgeted ($)"><Input type="number" placeholder="0" value={expForm.budgeted} onChange={e => setExpForm(f => ({ ...f, budgeted: e.target.value }))} /></FormField>
        <FormField label="Actual Spent ($)" hint="Leave 0 if not yet spent">
          <Input type="number" placeholder="0" value={expForm.actual} onChange={e => setExpForm(f => ({ ...f, actual: e.target.value }))} />
        </FormField>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">
      {!selectedTrip ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Your Trips</h3>
            <Button onClick={() => { setTripForm({ ...emptyTripForm }); setAddTripOpen(true) }}><Plus size={14} /> New Trip</Button>
          </div>

          {/* Afford calculator */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h4 className="font-medium text-white mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-brand-400" /> Can I Afford This Trip?
            </h4>
            <div className="flex gap-3 items-end">
              <FormField label="Trip cost ($)" hint={`Your total savings: ${formatCurrency(totalSavings)}`}>
                <Input type="number" placeholder="5000" value={affordCalc} onChange={e => setAffordCalc(e.target.value)} />
              </FormField>
              <div className="pb-0.5">
                {affordCalc && (
                  <div className={`px-4 py-2 rounded-xl text-sm font-medium ${parseFloat(affordCalc) <= totalSavings * 0.3 ? 'bg-emerald-500/20 text-emerald-400' : parseFloat(affordCalc) <= totalSavings * 0.6 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {parseFloat(affordCalc) <= totalSavings * 0.3 ? '✓ Comfortably affordable' : parseFloat(affordCalc) <= totalSavings * 0.6 ? '⚠ Stretch but possible' : '✗ Would strain savings'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trips.map(trip => {
              const totalBudgeted = trip.expenses.reduce((s, e) => s + e.budgeted, 0)
              const totalActual = trip.expenses.reduce((s, e) => s + e.actual, 0)
              const days = Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
              const isPast = new Date(trip.endDate) < new Date()
              return (
                <div key={trip.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-600 transition-colors" onClick={() => setSelectedTrip(trip)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Plane size={16} className="text-brand-400" />
                        <p className="font-semibold text-white">{trip.name}</p>
                        {isPast && <Badge color="gray">Past</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400"><MapPin size={12} /><span>{trip.destination}</span></div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => openEditTrip(trip)} className="p-1.5 text-gray-600 hover:text-white hover:bg-gray-700 rounded-lg cursor-pointer"><Edit2 size={13} /></button>
                      <button type="button" onClick={() => removeTrip(trip.id)} className="p-1.5 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3"><Calendar size={11} />{formatDate(trip.startDate)} → {formatDate(trip.endDate)} · {days} days</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-800 rounded-lg p-2"><p className="text-xs text-gray-500">Budget</p><p className="font-semibold text-white text-sm">{formatCurrency(trip.totalBudget, true)}</p></div>
                    <div className="bg-gray-800 rounded-lg p-2"><p className="text-xs text-gray-500">Planned</p><p className="font-semibold text-white text-sm">{formatCurrency(totalBudgeted, true)}</p></div>
                    <div className="bg-gray-800 rounded-lg p-2"><p className="text-xs text-gray-500">Spent</p><p className={`font-semibold text-sm ${totalActual > trip.totalBudget ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(totalActual, true)}</p></div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-brand-400"><span>View details</span><ChevronRight size={12} /></div>
                </div>
              )
            })}
            {trips.length === 0 && (
              <div className="col-span-2 text-center py-16 text-gray-500">
                <Plane size={40} className="mx-auto mb-3 opacity-30" />
                <p>No trips planned yet. Start planning your next adventure!</p>
              </div>
            )}
          </div>
        </>
      ) : (
        (() => {
          const trip = getTrip(selectedTrip.id) ?? selectedTrip
          const totalBudgeted = trip.expenses.reduce((s, e) => s + e.budgeted, 0)
          const totalActual = trip.expenses.reduce((s, e) => s + e.actual, 0)
          const remaining = trip.totalBudget - totalBudgeted
          const pieData = getPieData(trip)

          // Scenario totals
          const scenarioBudgeted = trip.expenses.reduce((s, e) => {
            const v = scenario[e.id]
            return s + (v !== undefined ? (parseFloat(v) || 0) : e.budgeted)
          }, 0)
          const scenarioDelta = scenarioBudgeted - totalBudgeted
          const scenarioRemaining = trip.totalBudget - scenarioBudgeted

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => { setSelectedTrip(null); setScenario({}); setShowScenario(false) }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">←</button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate">{trip.name}</h2>
                  <p className="text-sm text-gray-400 flex items-center gap-1"><MapPin size={12} />{trip.destination}</p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => { setShowScenario(s => !s); setScenario({}) }}>
                    <FlaskConical size={13} /> What if?
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEditTrip(trip)}><Edit2 size={13} /> Edit</Button>
                  <Button size="sm" onClick={() => { setExpForm({ ...emptyExpForm }); setAddExpOpen(true) }}><Plus size={13} /> Add Row</Button>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Total Budget</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(trip.totalBudget)}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Planned</p>
                  <p className={`text-xl font-bold ${totalBudgeted > trip.totalBudget ? 'text-rose-400' : 'text-white'}`}>{formatCurrency(totalBudgeted)}</p>
                  <ProgressBar value={totalBudgeted} max={trip.totalBudget} color={totalBudgeted > trip.totalBudget ? 'bg-rose-500' : 'bg-brand-500'} height="h-1" />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Actually Spent</p>
                  <p className={`text-xl font-bold ${totalActual > trip.totalBudget ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(totalActual)}</p>
                </div>
                <div className={`rounded-xl p-4 border ${remaining >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                  <p className="text-xs text-gray-400 mb-1">Remaining Budget</p>
                  <p className={`text-xl font-bold ${remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(Math.abs(remaining))}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{remaining >= 0 ? 'left to allocate' : 'over budget'}</p>
                </div>
              </div>

              {/* What-if scenario banner */}
              {showScenario && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={15} className="text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-300">
                      <span className="font-semibold">What-if mode</span> — edit the <span className="underline">Scenario</span> column freely. Changes aren't saved.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="text-gray-400">New total: <span className="font-semibold text-white">{formatCurrency(scenarioBudgeted)}</span></span>
                    <span className={`font-semibold ${scenarioDelta > 0 ? 'text-rose-400' : scenarioDelta < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {scenarioDelta > 0 ? '+' : ''}{formatCurrency(scenarioDelta)}
                    </span>
                    <span className={`font-semibold ${scenarioRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(Math.abs(scenarioRemaining))} {scenarioRemaining >= 0 ? 'left' : 'over'}
                    </span>
                    <button onClick={() => setScenario({})} className="text-xs text-gray-500 hover:text-white underline">reset</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Expense TABLE */}
                <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-4 py-3 font-medium">Item</th>
                          <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                          <th className="text-right px-4 py-3 font-medium">Actual</th>
                          <th className="text-right px-4 py-3 font-medium">+/−</th>
                          {showScenario && <th className="text-right px-4 py-3 font-medium text-amber-400">Scenario</th>}
                          <th className="px-2 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {trip.expenses.map(exp => {
                          const diff = exp.actual > 0 ? exp.actual - exp.budgeted : null
                          const scenVal = scenario[exp.id] !== undefined ? (parseFloat(scenario[exp.id]) || 0) : exp.budgeted
                          const scenDiff = scenVal - exp.budgeted
                          return (
                            <tr key={exp.id} className="hover:bg-gray-800/40 transition-colors group">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColors[exp.category] }} />
                                  <div>
                                    <p className="text-white font-medium leading-tight">{exp.description || catLabels[exp.category]}</p>
                                    {exp.description && <p className="text-[10px] text-gray-500 leading-tight">{catLabels[exp.category]}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <InlineNumber
                                  value={exp.budgeted}
                                  onSave={v => updateTripExpense(trip.id, exp.id, { budgeted: v })}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <InlineNumber
                                  value={exp.actual}
                                  onSave={v => updateTripExpense(trip.id, exp.id, { actual: v })}
                                  color={exp.actual > 0 ? (exp.actual > exp.budgeted ? 'text-rose-400' : 'text-emerald-400') : 'text-gray-500'}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {diff !== null ? (
                                  <span className={`text-sm font-medium tabular-nums ${diff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                  </span>
                                ) : <span className="text-gray-600 text-xs">—</span>}
                              </td>
                              {showScenario && (
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      className="w-24 text-right bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 text-sm text-amber-200 focus:outline-none focus:border-amber-400"
                                      value={scenario[exp.id] ?? String(exp.budgeted)}
                                      onChange={e => setScenario(s => ({ ...s, [exp.id]: e.target.value }))}
                                    />
                                    {scenDiff !== 0 && (
                                      <span className={`text-[10px] font-medium ${scenDiff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {scenDiff > 0 ? '+' : ''}{formatCurrency(scenDiff)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className="px-2 py-3">
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => openEditExp(exp)} className="p-1 text-gray-600 hover:text-white cursor-pointer"><Edit2 size={12} /></button>
                                  <button type="button" onClick={() => removeTripExpense(trip.id, exp.id)} className="p-1 text-gray-600 hover:text-rose-400 cursor-pointer"><Trash2 size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {trip.expenses.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-gray-700 bg-gray-800/30 font-semibold text-sm">
                            <td className="px-4 py-3 text-gray-400">Total</td>
                            <td className="px-4 py-3 text-right text-white">{formatCurrency(totalBudgeted)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={totalActual > totalBudgeted ? 'text-rose-400' : totalActual > 0 ? 'text-emerald-400' : 'text-gray-500'}>
                                {formatCurrency(totalActual)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {totalActual > 0 ? (
                                <span className={totalActual - totalBudgeted > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                  {totalActual - totalBudgeted > 0 ? '+' : ''}{formatCurrency(totalActual - totalBudgeted)}
                                </span>
                              ) : <span className="text-gray-600">—</span>}
                            </td>
                            {showScenario && (
                              <td className="px-4 py-3 text-right">
                                <span className={scenarioBudgeted > trip.totalBudget ? 'text-rose-400' : 'text-amber-300'}>
                                  {formatCurrency(scenarioBudgeted)}
                                </span>
                              </td>
                            )}
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    {trip.expenses.length === 0 && (
                      <p className="text-center text-gray-500 py-8 text-sm">No expenses yet. Hit "Add Row" to start planning.</p>
                    )}
                  </div>
                </div>

                {/* Pie chart */}
                {pieData.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-white mb-3 text-sm">Budget Allocation</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
                        <Legend formatter={v => <span className="text-xs text-gray-300">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )
        })()
      )}

      <Modal open={addTripOpen} onClose={() => { setAddTripOpen(false); setTripForm({ ...emptyTripForm }) }} title="New Trip"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddTripOpen(false); setTripForm({ ...emptyTripForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAddTrip} className="flex-1">Save</Button></div>}
      >{tripFormJsx}</Modal>
      <Modal open={!!editTripData} onClose={() => { setEditTripData(null); setTripForm({ ...emptyTripForm }) }} title="Edit Trip"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditTripData(null); setTripForm({ ...emptyTripForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEditTrip} className="flex-1">Save</Button></div>}
      >{tripFormJsx}</Modal>
      <Modal open={addExpOpen} onClose={() => { setAddExpOpen(false); setExpForm({ ...emptyExpForm }) }} title="Add Expense"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setAddExpOpen(false); setExpForm({ ...emptyExpForm }) }} className="flex-1">Cancel</Button><Button onClick={handleAddExp} className="flex-1">Save</Button></div>}
      >{expFormJsx}</Modal>
      <Modal open={!!editExpData} onClose={() => { setEditExpData(null); setExpForm({ ...emptyExpForm }) }} title="Edit Expense"
        footer={<div className="flex gap-3"><Button variant="secondary" onClick={() => { setEditExpData(null); setExpForm({ ...emptyExpForm }) }} className="flex-1">Cancel</Button><Button onClick={handleEditExp} className="flex-1">Save</Button></div>}
      >{expFormJsx}</Modal>
    </div>
  )
}
