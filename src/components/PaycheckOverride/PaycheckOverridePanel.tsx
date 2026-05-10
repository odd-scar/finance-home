import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency } from '../../utils/finance'
import { v4 as uuid } from 'uuid'

interface OneTimeItem {
  id: string
  label: string
  amount: string
}

interface PaycheckOverridePanelProps {
  open: boolean
  onClose: () => void
}

function parseDollar(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

export function PaycheckOverridePanel({ open, onClose }: PaycheckOverridePanelProps) {
  const { budget, bills, stocks, savings } = useAppStore()

  // Derive default fixed expenses from monthly bills
  const defaultFixed = bills
    .filter(b => b.frequency === 'monthly')
    .reduce((s, b) => s + b.amount, 0)

  // Derive stock/savings allocation ratio from current portfolio split
  const portfolioValue = stocks
    .filter(s => !s.watchlist && s.shares > 0)
    .reduce((sum, s) => sum + s.shares * s.currentPrice, 0)
  const totalSavingsBalance = savings.reduce((s, a) => s + a.balance, 0)
  const investTotal = portfolioValue + totalSavingsBalance
  const derivedStocksRatio = investTotal > 0
    ? Math.round((portfolioValue / investTotal) * 100)
    : 60

  // Panel state — reset when opened
  const [takeHome, setTakeHome] = useState('')
  const [fixedExp, setFixedExp] = useState(defaultFixed > 0 ? defaultFixed.toFixed(2) : '')
  const [oneTime, setOneTime] = useState<OneTimeItem[]>([])
  const [stocksRatio, setStocksRatio] = useState(derivedStocksRatio)
  const [showRatioEditor, setShowRatioEditor] = useState(false)
  const takeHomeRef = useRef<HTMLInputElement>(null)

  // Reset all fields when panel opens
  useEffect(() => {
    if (open) {
      setTakeHome('')
      setFixedExp(defaultFixed > 0 ? defaultFixed.toFixed(2) : '')
      setOneTime([])
      setStocksRatio(derivedStocksRatio)
      setShowRatioEditor(false)
      // Focus take-home after slide-in animation
      setTimeout(() => takeHomeRef.current?.focus(), 300)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // iOS scroll lock
  useEffect(() => {
    if (!open) return
    const scrollY = window.scrollY
    const body = document.body
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflowY = 'scroll'
    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflowY = ''
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior })
    }
  }, [open])

  // One-time payment helpers
  const addOneTime = () =>
    setOneTime(prev => [...prev, { id: uuid(), label: '', amount: '' }])

  const updateOneTime = (id: string, field: 'label' | 'amount', value: string) =>
    setOneTime(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))

  const removeOneTime = (id: string) =>
    setOneTime(prev => prev.filter(item => item.id !== id))

  // Live calculation
  const takeHomeNum = parseDollar(takeHome)
  const fixedExpNum = parseDollar(fixedExp)
  const oneTimeTotal = oneTime.reduce((s, i) => s + parseDollar(i.amount), 0)
  const remaining = takeHomeNum - fixedExpNum - oneTimeTotal
  const stocksAmt = remaining > 0 ? (remaining * stocksRatio) / 100 : 0
  const savingsAmt = remaining > 0 ? remaining - stocksAmt : 0
  const hasResult = takeHomeNum > 0

  const ratioSource = investTotal > 0 ? 'your current portfolio split' : 'default (60/40)'

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[200] bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel — right slide on desktop, bottom sheet on mobile */}
      <div
        className={`
          fixed z-[201] bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-white/5
          transition-transform duration-300 ease-in-out
          flex flex-col
          /* mobile: bottom sheet */
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[88vh]
          /* desktop: right drawer */
          sm:bottom-0 sm:top-0 sm:left-auto sm:right-0 sm:w-[440px] sm:max-h-none sm:rounded-none sm:rounded-l-2xl
          ${open
            ? 'translate-y-0 sm:translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
          }
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <Zap size={16} className="text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Paycheck Override</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="p-5 space-y-5 pb-8">

            {/* Take-home input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Take-home this paycheck
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  ref={takeHomeRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={takeHome}
                  onChange={e => setTakeHome(e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Fixed expenses */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-300">
                  Fixed expenses this period
                </label>
                {defaultFixed > 0 && (
                  <span className="text-xs text-gray-500">pre-filled from bills</span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={fixedExp}
                  onChange={e => setFixedExp(e.target.value)}
                  className="w-full pl-7 pr-4 py-2.5 bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* One-time payments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">One-time payments</label>
                <button
                  type="button"
                  onClick={addOneTime}
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {oneTime.length === 0 ? (
                <button
                  type="button"
                  onClick={addOneTime}
                  className="w-full py-3 border border-dashed border-gray-700 hover:border-gray-600 rounded-xl text-sm text-gray-500 hover:text-gray-400 transition-colors"
                >
                  + Add a one-time payment
                </button>
              ) : (
                <div className="space-y-2">
                  {oneTime.map((item, i) => (
                    <div key={item.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`e.g. Credit card extra`}
                        value={item.label}
                        onChange={e => updateOneTime(item.id, 'label', e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors text-sm"
                        style={{ fontSize: '16px' }}
                        autoFocus={i === oneTime.length - 1}
                      />
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="0"
                          value={item.amount}
                          onChange={e => updateOneTime(item.id, 'amount', e.target.value)}
                          className="w-full pl-6 pr-2 py-2 bg-gray-800 border border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-white placeholder-gray-600 outline-none transition-colors text-sm"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOneTime(item.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-rose-400 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {oneTime.length > 0 && (
                    <div className="flex justify-end text-xs text-gray-500 pt-0.5">
                      Total: <span className="text-gray-300 ml-1">{formatCurrency(oneTimeTotal)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Allocation ratio */}
            <div>
              <button
                type="button"
                onClick={() => setShowRatioEditor(v => !v)}
                className="flex items-center justify-between w-full text-sm text-gray-400 hover:text-gray-300 transition-colors py-1"
              >
                <span>
                  Allocation ratio:{' '}
                  <span className="text-white font-medium">{stocksRatio}% stocks / {100 - stocksRatio}% savings</span>
                </span>
                {showRatioEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showRatioEditor && (
                <div className="mt-3 p-4 bg-gray-800/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Savings 0%</span>
                    <span>Stocks {stocksRatio}%</span>
                    <span>100%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={stocksRatio}
                    onChange={e => setStocksRatio(Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                  <p className="text-xs text-gray-500">
                    Based on {ratioSource}. Drag to adjust for this paycheck.
                  </p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800" />

            {/* Results */}
            <div>
              {!hasResult ? (
                <div className="text-center py-4 text-gray-600 text-sm">
                  Enter your take-home amount above to see the breakdown.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Remaining */}
                  <div className={`rounded-xl p-4 ${remaining >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                    <p className="text-xs text-gray-400 mb-1">After expenses & one-time payments</p>
                    <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(remaining)} remaining
                    </p>
                    {remaining < 0 && (
                      <p className="text-xs text-rose-400 mt-1">
                        You're {formatCurrency(Math.abs(remaining))} short — review your expenses.
                      </p>
                    )}
                  </div>

                  {/* Recommended allocation */}
                  {remaining > 0 && (
                    <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recommended this paycheck</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-sm text-gray-300">Stocks</span>
                          <span className="text-xs text-gray-500">{stocksRatio}%</span>
                        </div>
                        <span className="text-base font-semibold text-emerald-400">{formatCurrency(stocksAmt)}</span>
                      </div>

                      {/* Allocation bar */}
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${stocksRatio}%` }}
                        />
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all duration-300"
                          style={{ width: `${100 - stocksRatio}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-sky-400" />
                          <span className="text-sm text-gray-300">Savings</span>
                          <span className="text-xs text-gray-500">{100 - stocksRatio}%</span>
                        </div>
                        <span className="text-base font-semibold text-sky-400">{formatCurrency(savingsAmt)}</span>
                      </div>
                    </div>
                  )}

                  {/* Disclaimer note */}
                  <p className="text-xs text-gray-600 text-center leading-relaxed px-2">
                    Based on your normal allocation ratio. Your budget hasn't been changed.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
