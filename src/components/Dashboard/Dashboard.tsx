import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, calcPctChange, formatPercent } from '../../utils/finance'
import { StatCard } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { snapshotNetWorth } from '../../store/store'
import {
  TrendingUp, CreditCard, PiggyBank, Target, Wallet,
  ArrowUpRight, ArrowDownRight, Camera, Package,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, LineChart, Line,
} from 'recharts'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
}

const currentMonthStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Dashboard() {
  const { stocks, debts, savings, goals, budget, assets, netWorthHistory } = useAppStore()

  // Totals
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0)
  const totalAssets = assets.reduce((s, a) => s + a.value, 0)
  const portfolioValue = stocks
    .filter(s => !s.watchlist && s.shares > 0)
    .reduce((sum, s) => sum + s.shares * s.currentPrice, 0)
  const portfolioCost = stocks
    .filter(s => !s.watchlist && s.shares > 0)
    .reduce((sum, s) => sum + s.shares * s.purchasePrice, 0)
  const netWorth = totalSavings + portfolioValue + totalAssets - totalDebt

  // Emergency fund ratio
  const emergencySavings = savings
    .filter(a => a.category === 'emergency')
    .reduce((s, a) => s + a.balance, 0)
  const now = new Date()
  const curM = now.getMonth() + 1, curY = now.getFullYear()
  // Average monthly expenses from last 3 months of budget
  const last3MonthsExpenses: number[] = []
  for (let i = 1; i <= 3; i++) {
    const m = curM - i <= 0 ? curM - i + 12 : curM - i
    const y = curM - i <= 0 ? curY - 1 : curY
    const exp = budget
      .filter(b => b.month === m && b.year === y && b.type === 'expense')
      .reduce((s, b) => s + b.amount, 0)
    if (exp > 0) last3MonthsExpenses.push(exp)
  }
  const avgMonthlyExpenses = last3MonthsExpenses.length > 0
    ? last3MonthsExpenses.reduce((s, v) => s + v, 0) / last3MonthsExpenses.length
    : 0
  const emergencyMonths = avgMonthlyExpenses > 0 ? emergencySavings / avgMonthlyExpenses : 0
  const emergencyTarget = 6

  // Savings trend (last 6 months)
  const savingsTrend = savings
    .flatMap(a => a.history)
    .reduce((acc, h) => {
      const found = acc.find(x => x.month === h.month)
      if (found) found.balance += h.balance
      else acc.push({ month: h.month, balance: h.balance })
      return acc
    }, [] as { month: string; balance: number }[])
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map(x => ({ ...x, label: x.month.slice(5) + '/' + x.month.slice(2, 4) }))

  // Budget overview (current month)
  const monthBudget = budget.filter(b => b.month === curM && b.year === curY)
  const income = monthBudget.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
  const expenses = monthBudget.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)

  // Recent 6 months budget
  const budgetTrend = []
  for (let i = 5; i >= 0; i--) {
    const m = curM - i <= 0 ? curM - i + 12 : curM - i
    const y = curM - i <= 0 ? curY - 1 : curY
    const entries = budget.filter(b => b.month === m && b.year === y)
    const inc = entries.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
    const exp = entries.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    const d = new Date(y, m - 1, 1)
    budgetTrend.push({
      label: d.toLocaleString('en-US', { month: 'short' }),
      income: inc,
      expenses: exp,
    })
  }

  // Top goals
  const topGoals = [...goals]
    .sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))
    .slice(0, 4)

  const portfolioPct = calcPctChange(portfolioCost, portfolioValue)

  // Net worth history chart (last 12)
  const nwChartData = netWorthHistory
    .slice(-12)
    .map(h => ({ label: h.month.slice(5) + '/' + h.month.slice(2, 4), net: h.net }))

  const doSnapshot = () => {
    const month = currentMonthStr()
    const savTotal = savings.reduce((s, a) => s + a.balance, 0)
    const portValue = stocks.filter(s => !s.watchlist && s.shares > 0).reduce((s, st) => s + st.shares * st.currentPrice, 0)
    const assTotal = assets.reduce((s, a) => s + a.value, 0)
    const debtTotal = debts.reduce((s, d) => s + d.balance, 0)
    snapshotNetWorth({
      month,
      savings: savTotal,
      portfolio: portValue,
      assets: assTotal,
      debt: debtTotal,
      net: savTotal + portValue + assTotal - debtTotal,
    })
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Net Worth"
          value={formatCurrency(netWorth, true)}
          sub={netWorth >= 0 ? 'Assets exceed liabilities' : 'Liabilities exceed assets'}
          subColor={netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          icon={<Wallet size={20} className="text-brand-400" />}
          iconBg="bg-brand-600/20"
        />
        <StatCard
          label="Portfolio Value"
          value={formatCurrency(portfolioValue, true)}
          sub={formatPercent(portfolioPct) + ' all time'}
          subColor={portfolioPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          icon={<TrendingUp size={20} className="text-emerald-400" />}
          iconBg="bg-emerald-500/20"
        />
        <StatCard
          label="Total Savings"
          value={formatCurrency(totalSavings, true)}
          sub={`Across ${savings.length} account${savings.length !== 1 ? 's' : ''}`}
          icon={<PiggyBank size={20} className="text-sky-400" />}
          iconBg="bg-sky-500/20"
        />
        <StatCard
          label="Total Debt"
          value={formatCurrency(totalDebt, true)}
          sub={`Across ${debts.length} account${debts.length !== 1 ? 's' : ''}`}
          subColor="text-rose-400"
          icon={<CreditCard size={20} className="text-rose-400" />}
          iconBg="bg-rose-500/20"
        />
      </div>

      {/* Emergency Fund + Assets row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Emergency Fund Ratio */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Emergency Fund</h3>
            <PiggyBank size={16} className="text-gray-500" />
          </div>
          {emergencySavings === 0 ? (
            <p className="text-sm text-gray-500 py-2">No emergency savings account found. Add a savings account with the "Emergency" category.</p>
          ) : avgMonthlyExpenses === 0 ? (
            <div>
              <p className="text-2xl font-bold text-white">{formatCurrency(emergencySavings, true)}</p>
              <p className="text-xs text-gray-500 mt-1">Add budget entries to calculate months covered</p>
            </div>
          ) : (
            <div>
              <div className="flex items-end gap-2 mb-3">
                <p className={`text-3xl font-bold ${emergencyMonths >= 6 ? 'text-emerald-400' : emergencyMonths >= 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {emergencyMonths.toFixed(1)}
                </p>
                <p className="text-gray-400 text-sm mb-1">months covered</p>
                <p className="text-gray-600 text-xs mb-1">/ {emergencyTarget} target</p>
              </div>
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${emergencyMonths >= 6 ? 'bg-emerald-500' : emergencyMonths >= 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, (emergencyMonths / emergencyTarget) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1.5">
                <span>{formatCurrency(emergencySavings, true)} saved</span>
                <span>Goal: {formatCurrency(avgMonthlyExpenses * emergencyTarget, true)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Physical Assets */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Physical Assets</h3>
            <Package size={16} className="text-gray-500" />
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No assets tracked. Add your car, electronics, or other valuables in the Assets tab.</p>
          ) : (
            <div>
              <p className="text-3xl font-bold text-white mb-3">{formatCurrency(totalAssets, true)}</p>
              <div className="space-y-2">
                {assets.slice(0, 3).map(asset => (
                  <div key={asset.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 truncate">{asset.name}</span>
                    <span className="text-white font-medium ml-2 shrink-0">{formatCurrency(asset.value, true)}</span>
                  </div>
                ))}
                {assets.length > 3 && (
                  <p className="text-xs text-gray-600">+{assets.length - 3} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Savings trend */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <h3 className="font-semibold text-white mb-1">Savings Growth</h3>
          {savingsTrend.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-center gap-2">
              <PiggyBank size={32} className="text-gray-700" />
              <p className="text-sm text-gray-500">No savings data yet</p>
              <p className="text-xs text-gray-600">Add your savings accounts — the chart will track your growth month by month</p>
            </div>
          ) : savingsTrend.length === 1 ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-center gap-2">
              <p className="text-xs text-gray-500 mb-1">Tracking started this month</p>
              <p className="text-3xl font-bold text-brand-400">{formatCurrency(savingsTrend[0].balance, true)}</p>
              <p className="text-xs text-gray-600">Update your balances each month to see growth over time</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3">{savingsTrend.length} months of data</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={savingsTrend}>
                  <defs>
                    <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Savings']} />
                  <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2} fill="url(#savGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Income vs Expenses */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <h3 className="font-semibold text-white mb-4">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={budgetTrend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Worth History Chart */}
      <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Net Worth Over Time</h3>
          <button
            onClick={doSnapshot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 rounded-lg text-xs font-medium transition-colors"
          >
            <Camera size={12} /> Snapshot
          </button>
        </div>
        {nwChartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-[140px] text-center gap-2">
            <TrendingUp size={28} className="text-gray-700" />
            <p className="text-sm text-gray-500">Click 'Snapshot' monthly to track your net worth over time</p>
            <p className="text-xs text-gray-600">{nwChartData.length === 1 ? '1 snapshot recorded — add another next month' : 'No snapshots yet'}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">{nwChartData.length} monthly snapshots</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={nwChartData}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Net Worth']} />
                <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} name="Net Worth" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Goals + This month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Financial Goals */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Top Goals</h3>
            <Target size={16} className="text-gray-500" />
          </div>
          <div className="space-y-4">
            {topGoals.map(goal => {
              const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white font-medium">{goal.name}</span>
                    <span className="text-gray-400">{pct.toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={goal.currentAmount} max={goal.targetAmount} color="bg-brand-500" />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatCurrency(goal.currentAmount, true)}</span>
                    <span>{formatCurrency(goal.targetAmount, true)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* This month */}
        <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
          <h3 className="font-semibold text-white mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <ArrowUpRight size={16} className="text-emerald-400" />
                </div>
                <span className="text-sm text-white">Income</span>
              </div>
              <span className="font-semibold text-emerald-400">{formatCurrency(income)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-rose-500/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg">
                  <ArrowDownRight size={16} className="text-rose-400" />
                </div>
                <span className="text-sm text-white">Expenses</span>
              </div>
              <span className="font-semibold text-rose-400">{formatCurrency(expenses)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
              <span className="text-sm text-gray-300">Net</span>
              <span className={`font-bold ${income - expenses >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {income - expenses >= 0 ? '+' : ''}{formatCurrency(income - expenses)}
              </span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Savings rate</span>
                <span>{income > 0 ? Math.max(0, (((income - expenses) / income) * 100)).toFixed(0) : 0}%</span>
              </div>
              <ProgressBar value={Math.max(0, income - expenses)} max={Math.max(1, income)} color="bg-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Debt overview */}
      <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-5 transition-all duration-200">
        <h3 className="font-semibold text-white mb-4">Debt Snapshot</h3>
        <div className="space-y-3">
          {debts.map(debt => {
            const paidOff = debt.originalBalance > 0 ? 1 - debt.balance / debt.originalBalance : 0
            return (
              <div key={debt.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{debt.name}</span>
                    <span className="text-gray-400">{formatCurrency(debt.balance)}</span>
                  </div>
                  <ProgressBar value={paidOff * 100} max={100} color="bg-rose-500" height="h-1.5" />
                </div>
                <span className="text-xs text-gray-500 w-14 text-right">{(paidOff * 100).toFixed(0)}% paid</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
