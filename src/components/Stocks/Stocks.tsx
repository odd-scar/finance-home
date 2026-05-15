import { useState, useEffect } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency, formatPercent, calcPctChange, linearRegression } from '../../utils/finance'
import { simulateRefresh, getStockInfo, generatePriceHistory } from '../../utils/mockStockData'
import {
  fetchQuotes, getCacheAge,
  type FetchStatus,
} from '../../utils/alphaVantage'
import { refreshStockPrices, addStock, removeStock, updateStock } from '../../store/store'
import { Modal } from '../ui/Modal'
import { Button, Input, FormField } from '../ui/FormField'
import { Card } from '../ui/Card'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  Star, AlertTriangle, CheckCircle, Clock,
  RefreshCw, Loader2, Edit2,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { Stock } from '../../types'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '11px',
  padding: '4px 8px',
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#fb923c']

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width={80} height={36}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={positive ? '#10b981' : '#f43f5e'} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function StockDetailChart({ stock }: { stock: Stock }) {
  const data = stock.priceHistory.map((v, i) => ({ day: i + 1, price: v }))
  const reg = linearRegression(stock.priceHistory)
  const merged = data.map((d, i) => ({ ...d, trend: Math.round(reg.predict(i) * 100) / 100 }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={merged}>
        <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Trading Days', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} height={36} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={v => `$${v}`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [formatCurrency(v), name === 'trend' ? 'Trend' : 'Price']} />
        <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} dot={false} name="Price" />
        <Line type="monotone" dataKey="trend" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Trend" />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function Stocks() {
  const { stocks, lastStockUpdate } = useAppStore()
  const [refreshing, setRefreshing] = useState(false)
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Stock | null>(null)
  const [form, setForm] = useState({ symbol: '', shares: '', purchasePrice: '', watchlist: false })
  // Move watchlist stock to portfolio
  const [moveStock, setMoveStock] = useState<Stock | null>(null)
  const [moveForm, setMoveForm] = useState({ shares: '', purchasePrice: '' })
  // Edit an existing holding's shares / purchase price
  const [editStock, setEditStock] = useState<Stock | null>(null)
  const [editStockForm, setEditStockForm] = useState({ shares: '', purchasePrice: '' })

  // Always derive from live store so detail modal stays current after a price refresh
  const selectedStock = selected ? stocks.find(s => s.id === selected.id) ?? null : null

  const ownedStocks = stocks.filter(s => !s.watchlist && s.shares > 0)
  const watchlistStocks = stocks.filter(s => s.watchlist)

  const totalValue = ownedStocks.reduce((s, st) => s + st.shares * st.currentPrice, 0)
  const totalCost  = ownedStocks.reduce((s, st) => s + st.shares * st.purchasePrice, 0)
  const totalGain  = totalValue - totalCost
  const totalGainPct = calcPctChange(totalCost, totalValue)

  // Build pie data in stable order (same as ownedStocks order)
  const pieData = ownedStocks.map(st => ({
    symbol: st.symbol,
    value: st.shares * st.currentPrice,
    pct: totalValue > 0 ? ((st.shares * st.currentPrice) / totalValue) * 100 : 0,
  }))

  // Stable color map: symbol → hex color, keyed on original pieData order so
  // the legend and the pie slices always share the same color for each stock.
  const pieColorMap = new Map<string, string>(
    pieData.map((item, i) => [item.symbol, PIE_COLORS[i % PIE_COLORS.length]])
  )

  // Sorted copy for the legend — does NOT mutate pieData so pie slice colors stay stable
  const pieDataSorted = [...pieData].sort((a, b) => b.value - a.value)

  const handleRefreshReal = async (force = false) => {
    setRefreshing(true)
    setFetchStatus(null)
    const symbols = stocks.map(s => s.symbol)
    try {
      const { quotes, status } = await fetchQuotes(symbols, force)
      setFetchStatus(status)
      const updates = stocks
        .filter(s => quotes[s.symbol])
        .map(s => {
          const q = quotes[s.symbol]!
          const newHistory = [...s.priceHistory.slice(1), q.price]
          return { id: s.id, currentPrice: q.price, priceHistory: newHistory }
        })
      if (updates.length > 0) refreshStockPrices(updates)
    } catch {
      setFetchStatus({ success: [], cached: [], failed: symbols, rateLimited: false })
    }
    setRefreshing(false)
  }

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleManualRefresh = async () => {
    if (cooldown > 0 || refreshing) return
    setCooldown(60)
    setRefreshing(true)
    setFetchStatus(null)
    const symbols = stocks.map(s => s.symbol)
    try {
      const { quotes, status } = await fetchQuotes(symbols, true)
      setFetchStatus(status)
      const updates = stocks
        .filter(s => quotes[s.symbol])
        .map(s => {
          const q = quotes[s.symbol]!
          const newHistory = [...s.priceHistory.slice(1), q.price]
          return { id: s.id, currentPrice: q.price, priceHistory: newHistory }
        })
      if (updates.length > 0) {
        refreshStockPrices(updates)
      } else {
        refreshStockPrices(simulateRefresh(stocks))
        setFetchStatus({ success: [], cached: [], failed: symbols, rateLimited: false })
      }
    } catch {
      refreshStockPrices(simulateRefresh(stocks))
      setFetchStatus({ success: [], cached: [], failed: symbols, rateLimited: false })
    }
    setRefreshing(false)
  }

  const handleAdd = () => {
    if (!form.symbol) return
    const sym = form.symbol.toUpperCase().trim()
    const info = getStockInfo(sym)
    const shares = parseFloat(form.shares) || 0
    const purchasePrice = parseFloat(form.purchasePrice) || info.currentPrice
    const stock: Stock = {
      id: uuid(),
      symbol: sym,
      name: info.name,
      shares,
      purchasePrice,
      currentPrice: info.currentPrice,
      priceHistory: generatePriceHistory(sym, info.currentPrice),
      watchlist: form.watchlist || shares === 0,
      addedAt: new Date().toISOString(),
    }
    addStock(stock)
    setForm({ symbol: '', shares: '', purchasePrice: '', watchlist: false })
    setAddOpen(false)
  }

  const pctChange = (s: Stock) => calcPctChange(s.purchasePrice, s.currentPrice)
  const dayChange = (s: Stock) => {
    const h = s.priceHistory
    return h.length >= 2 ? calcPctChange(h[h.length - 2], h[h.length - 1]) : 0
  }

  const lastUpdateLabel = lastStockUpdate
    ? new Date(lastStockUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  // Auto-fetch on tab open (fetchQuotes handles the 1hr cache internally)
  useEffect(() => {
    if (stocks.length > 0) handleRefreshReal(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-fade-in">

      {/* Fetch status notification */}
      {fetchStatus && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${
          fetchStatus.failed.length > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          {fetchStatus.failed.length > 0
            ? <><AlertTriangle size={14} /> {fetchStatus.success.length} updated · {fetchStatus.cached.length} from cache · {fetchStatus.failed.length} failed</>
            : <><CheckCircle size={14} /> Prices up to date · {fetchStatus.cached.length > 0 ? `${fetchStatus.cached.length} from cache` : `${fetchStatus.success.length} live`}</>
          }
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalValue, true)}</p>
          <p className={`text-sm ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)} ({formatPercent(totalGainPct)}) all time
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={cooldown > 0 || refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-700 bg-gray-900 text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {refreshing
                ? <Loader2 size={13} className="animate-spin text-brand-400" />
                : <RefreshCw size={13} />
              }
              {cooldown > 0 ? `Available in ${cooldown}s` : 'Refresh Prices'}
            </button>
            {lastUpdateLabel && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={11} /> {lastUpdateLabel}
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => { setForm({ symbol: '', shares: '', purchasePrice: '', watchlist: false }); setAddOpen(true) }}>
            <Plus size={13} /> Add Stock
          </Button>
        </div>
      </div>

      {/* Holdings table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Portfolio Holdings</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left px-5 py-3 font-medium">Symbol</th>
                <th className="text-right px-4 py-3 font-medium">Shares</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Day Chg</th>
                <th className="text-right px-4 py-3 font-medium">Value</th>
                <th className="text-right px-4 py-3 font-medium">Total Gain</th>
                <th className="px-4 py-3 font-medium">Trend</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ownedStocks.map(stock => {
                const value = stock.shares * stock.currentPrice
                const allTimePct = pctChange(stock)
                const todayPct = dayChange(stock)
                const cacheAge = getCacheAge(stock.symbol)
                return (
                  <tr
                    key={stock.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelected(stock)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-white">{stock.symbol}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[130px]">{stock.name}</p>
                      {cacheAge !== null && (
                        <p className="text-xs text-gray-600">{cacheAge === 0 ? 'just now' : `${cacheAge}m ago`}</p>
                      )}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-300">{stock.shares}</td>
                    <td className="text-right px-4 py-3 text-white font-medium">{formatCurrency(stock.currentPrice)}</td>
                    <td className={`text-right px-4 py-3 font-medium ${todayPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {todayPct >= 0 ? '+' : ''}{todayPct.toFixed(2)}%
                    </td>
                    <td className="text-right px-4 py-3 text-white font-medium">{formatCurrency(value)}</td>
                    <td className={`text-right px-4 py-3 font-medium ${allTimePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {allTimePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {formatPercent(allTimePct)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Sparkline data={stock.priceHistory.slice(-13)} positive={allTimePct >= 0} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setEditStock(stock); setEditStockForm({ shares: String(stock.shares), purchasePrice: String(stock.purchasePrice) }) }}
                          className="p-1.5 rounded-lg hover:bg-brand-500/20 text-gray-600 hover:text-brand-400 transition-colors"
                          title="Edit position"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeStock(stock.id) }}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-600 hover:text-rose-400 transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {ownedStocks.length === 0 && (
            <p className="text-center text-gray-500 py-10">No holdings yet. Add your first stock!</p>
          )}
        </div>

        {/* Mobile card list */}
        <div className="block sm:hidden divide-y divide-gray-800">
          {ownedStocks.map(stock => {
            const value = stock.shares * stock.currentPrice
            const allTimePct = pctChange(stock)
            const todayPct = dayChange(stock)
            return (
              <div
                key={stock.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                onClick={() => setSelected(stock)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{stock.symbol}</p>
                    <p className="text-xs text-gray-500 truncate">{stock.name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{stock.shares} shares</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-white">{formatCurrency(stock.currentPrice)}</p>
                  <p className={`text-xs font-medium ${allTimePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {allTimePct >= 0 ? '+' : ''}{allTimePct.toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-500">{formatCurrency(value)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setEditStock(stock); setEditStockForm({ shares: String(stock.shares), purchasePrice: String(stock.purchasePrice) }) }}
                    className="p-1.5 rounded-lg hover:bg-brand-500/20 text-gray-600 hover:text-brand-400 transition-colors"
                    title="Edit position"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeStock(stock.id) }}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {ownedStocks.length === 0 && (
            <p className="text-center text-gray-500 py-10">No holdings yet. Add your first stock!</p>
          )}
        </div>
      </div>

      {/* Portfolio Allocation Pie Chart */}
      {ownedStocks.length >= 2 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Portfolio Allocation</h3>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="shrink-0 w-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="symbol"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {pieData.map((item) => (
                      <Cell key={item.symbol} fill={pieColorMap.get(item.symbol)!} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _name: string, props) => [
                      `${formatCurrency(v)} (${(props.payload as typeof pieData[0]).pct.toFixed(1)}%)`,
                      props.name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full">
              <div className="space-y-2">
                {pieDataSorted.map((item) => (
                  <div key={item.symbol} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: pieColorMap.get(item.symbol) }}
                    />
                    <span className="text-sm font-medium text-white w-12 sm:w-14 shrink-0">{item.symbol}</span>
                    <div className="flex-1 min-w-0 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: pieColorMap.get(item.symbol),
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-9 sm:w-10 text-right shrink-0">{item.pct.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500 w-16 sm:w-20 text-right shrink-0">{formatCurrency(item.value, true)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Watchlist */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Star size={16} className="text-amber-400" /> Watchlist
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {watchlistStocks.map(stock => {
            const todayPct = dayChange(stock)
            return (
              <Card key={stock.id} className="!p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-white">{stock.symbol}</p>
                    <p className="text-xs text-gray-500">{stock.name}</p>
                  </div>
                  <button type="button" onClick={() => removeStock(stock.id)} className="p-1 text-gray-600 hover:text-rose-400">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">{formatCurrency(stock.currentPrice)}</p>
                    <p className={`text-xs ${todayPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {todayPct >= 0 ? '+' : ''}{todayPct.toFixed(2)}% today
                    </p>
                  </div>
                  <Sparkline data={stock.priceHistory.slice(-13)} positive={todayPct >= 0} />
                </div>
                <button
                  type="button"
                  className="mt-3 w-full text-xs py-1.5 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 rounded-lg transition-colors"
                  onClick={() => { setMoveStock(stock); setMoveForm({ shares: '', purchasePrice: '' }) }}
                >
                  Move to Portfolio
                </button>
              </Card>
            )
          })}
          {watchlistStocks.length === 0 && (
            <p className="text-gray-500 text-sm col-span-3 py-4">No watchlist items.</p>
          )}
        </div>
      </div>

      {/* ── Add Stock Modal ───────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setForm({ symbol: '', shares: '', purchasePrice: '', watchlist: false }) }}
        title="Add Stock"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setAddOpen(false); setForm({ symbol: '', shares: '', purchasePrice: '', watchlist: false }) }} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} className="flex-1">Add</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Ticker Symbol">
            <Input
              placeholder="e.g. AAPL, MSFT, NVDA"
              value={form.symbol}
              onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.watchlist} onChange={e => setForm(f => ({ ...f, watchlist: e.target.checked }))} />
            Watchlist only (I don't own this yet)
          </label>
          {!form.watchlist && (
            <>
              <FormField label="Number of Shares">
                <Input type="number" placeholder="0" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
              </FormField>
              <FormField label="Purchase Price per Share ($)" hint="Leave blank to use current market price">
                <Input type="number" placeholder="0.00" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} />
              </FormField>
            </>
          )}
        </div>
      </Modal>

      {/* ── Move to Portfolio Modal ───────────────────────────────────── */}
      <Modal
        open={!!moveStock}
        onClose={() => setMoveStock(null)}
        title={moveStock ? `Add ${moveStock.symbol} to Portfolio` : ''}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setMoveStock(null)} className="flex-1">Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!moveStock) return
                const shares = parseFloat(moveForm.shares)
                if (!shares || shares <= 0) return
                const purchasePrice = parseFloat(moveForm.purchasePrice) || moveStock.currentPrice
                updateStock(moveStock.id, { watchlist: false, shares, purchasePrice })
                setMoveStock(null)
              }}
            >
              Add to Portfolio
            </Button>
          </div>
        }
      >
        {moveStock && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Enter how many shares of <strong className="text-white">{moveStock.symbol}</strong> you own and what you paid.
            </p>
            <FormField label="Number of Shares">
              <Input
                type="number"
                placeholder="0"
                value={moveForm.shares}
                onChange={e => setMoveForm(f => ({ ...f, shares: e.target.value }))}
                autoFocus
              />
            </FormField>
            <FormField label="Purchase Price per Share ($)" hint="Leave blank to use current price">
              <Input
                type="number"
                placeholder={moveStock.currentPrice.toFixed(2)}
                value={moveForm.purchasePrice}
                onChange={e => setMoveForm(f => ({ ...f, purchasePrice: e.target.value }))}
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ── Edit Position Modal ───────────────────────────────────────── */}
      <Modal
        open={!!editStock}
        onClose={() => setEditStock(null)}
        title={editStock ? `Edit ${editStock.symbol} Position` : ''}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEditStock(null)} className="flex-1">Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!editStock) return
                const shares = parseFloat(editStockForm.shares)
                if (!shares || shares <= 0) return
                const purchasePrice = parseFloat(editStockForm.purchasePrice) || editStock.purchasePrice
                updateStock(editStock.id, { shares, purchasePrice })
                setEditStock(null)
              }}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {editStock && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-white">{editStock.symbol}</p>
                <p className="text-xs text-gray-400">{editStock.name}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-semibold text-white">{formatCurrency(editStock.currentPrice)}</p>
                <p className="text-xs text-gray-400">current price</p>
              </div>
            </div>
            <FormField label="Number of Shares">
              <Input
                type="number"
                placeholder="0"
                value={editStockForm.shares}
                onChange={e => setEditStockForm(f => ({ ...f, shares: e.target.value }))}
                autoFocus
              />
            </FormField>
            <FormField label="Average Purchase Price per Share ($)">
              <Input
                type="number"
                placeholder={editStock.purchasePrice.toFixed(2)}
                value={editStockForm.purchasePrice}
                onChange={e => setEditStockForm(f => ({ ...f, purchasePrice: e.target.value }))}
              />
            </FormField>
            {editStockForm.shares && editStockForm.purchasePrice && (
              <div className="p-3 bg-gray-800/60 rounded-xl text-xs text-gray-400">
                <div className="flex justify-between mb-1">
                  <span>Total cost basis</span>
                  <span className="text-white">{formatCurrency(parseFloat(editStockForm.shares) * parseFloat(editStockForm.purchasePrice))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current value</span>
                  <span className="text-white">{formatCurrency(parseFloat(editStockForm.shares) * editStock.currentPrice)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Stock Detail Modal ────────────────────────────────────────── */}
      <Modal open={!!selectedStock} onClose={() => setSelected(null)} title={selectedStock ? `${selectedStock.symbol} — ${selectedStock.name}` : ''} size="lg">
        {selectedStock && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Current Price</p>
                <p className="font-bold text-white">{formatCurrency(selectedStock.currentPrice)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Avg Cost</p>
                <p className="font-bold text-white">{formatCurrency(selectedStock.purchasePrice)}</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${pctChange(selectedStock) >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                <p className="text-xs text-gray-400">Total Return</p>
                <p className={`font-bold ${pctChange(selectedStock) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPercent(pctChange(selectedStock))}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Price History + Linear Trend</p>
              <StockDetailChart stock={selectedStock} />
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-2">Trend Prediction — next 5 data points</p>
              {(() => {
                const reg = linearRegression(selectedStock.priceHistory)
                const n = selectedStock.priceHistory.length
                return (
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map(i => {
                      const p = reg.predict(n - 1 + i)
                      return (
                        <div key={i} className="flex-1 text-center">
                          <p className="text-xs text-gray-500">+{i}</p>
                          <p className={`text-sm font-medium ${p >= selectedStock.currentPrice ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(p)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
