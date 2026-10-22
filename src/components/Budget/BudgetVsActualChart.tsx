import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { formatCurrency } from '../../lib/finance'
import { SAVINGS_CATEGORY, type CategoryPlanRow } from '../../lib/budgetMath'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

/** Spent bar color: green under plan, amber when close, red when over (savings: green when met) */
function spentColor(r: CategoryPlanRow) {
  if (r.category === SAVINGS_CATEGORY) return r.spent >= r.planned ? '#10b981' : '#0ea5e9'
  const pct = r.planned > 0 ? r.spent / r.planned : 0
  return pct > 1 ? '#f43f5e' : pct >= 0.8 ? '#f59e0b' : '#10b981'
}

/** Budgeted vs actual for each planned category this month (horizontal bars — readable on a phone) */
export function BudgetVsActualChart({ rows }: { rows: CategoryPlanRow[] }) {
  const data = rows.map(r => ({
    name: r.category === SAVINGS_CATEGORY ? 'Savings' : r.category,
    Planned: Math.round(r.planned * 100) / 100,
    Spent: Math.round(r.spent * 100) / 100,
    row: r,
  }))
  // Totals are for spending only — saving more than planned is good, not "over budget"
  const spending = rows.filter(r => r.category !== SAVINGS_CATEGORY)
  const totalPlanned = spending.reduce((s, r) => s + r.planned, 0)
  const totalSpent = spending.reduce((s, r) => s + r.spent, 0)

  return (
    <div className="px-3 pt-3 pb-4 border-b border-gray-800">
      <div className="flex items-center justify-between px-2 mb-2 text-xs">
        <span className="flex items-center gap-3 text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-600" /> Planned</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Spent</span>
        </span>
        {totalPlanned > 0 && (
          <span className={totalSpent > totalPlanned ? 'text-rose-400' : 'text-gray-400'}>
            Spent {formatCurrency(totalSpent)} of {formatCurrency(totalPlanned)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 46 + 30)}>
        <BarChart data={data} layout="vertical" barGap={2} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#1f2937" />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <YAxis type="category" dataKey="name" width={92} tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: '#ffffff08' }}
            formatter={(v: number, name: string) => [formatCurrency(v), name]}
          />
          <Bar dataKey="Planned" fill="#4b5563" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
          <Bar dataKey="Spent" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
            {data.map(d => <Cell key={d.name} fill={spentColor(d.row)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
