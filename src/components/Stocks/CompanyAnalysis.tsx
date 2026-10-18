import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { AlertTriangle, CheckCircle, Info, Loader2, ChevronDown, Building2, LineChart as LineIcon } from 'lucide-react'
import { formatCurrency, parseLocalDate } from '../../utils/finance'
import { useFundamentals } from '../../utils/fundamentalsClient'
import { analyzeBusiness, fmtMoney, type Verdict } from '../../utils/businessAnalysis'
import { analyzeStock, stockInsights, type PriceHistory, type StockMetrics, type Insight } from '../../utils/stockAnalysis'

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '11px', padding: '4px 8px',
}

const VERDICT_DOT: Record<Verdict, string> = {
  good: 'bg-emerald-400', ok: 'bg-gray-400', watch: 'bg-amber-400', info: 'bg-gray-600',
}
const VERDICT_TEXT: Record<Verdict, string> = {
  good: 'text-emerald-400', ok: 'text-gray-200', watch: 'text-amber-400', info: 'text-gray-300',
}

export function InsightList({ items }: { items: Insight[] }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
          {it.tone === 'warn'
            ? <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            : it.tone === 'good'
              ? <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              : <Info size={13} className="text-sky-400 shrink-0 mt-0.5" />}
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Business tab ───────────────────────────────────────────────────────────

function BusinessTab({ symbol, price }: { symbol: string; price: number | null }) {
  const state = useFundamentals(symbol)

  if (!state || state.status === 'loading') {
    return <p className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center"><Loader2 size={15} className="animate-spin" /> Reading {symbol}'s annual reports…</p>
  }
  if (state.status === 'unavailable') {
    return (
      <div className="py-6 text-center space-y-2">
        <p className="text-sm text-gray-300">{state.message}</p>
        {state.reason === 'not_found' && (
          <p className="text-xs text-gray-500">Funds and ETFs hold many companies, so business analysis applies to their individual holdings rather than the fund. Check the Price tab for risk and returns.</p>
        )}
        {state.reason === 'setup' && (
          <p className="text-xs text-gray-500">In Vercel → Settings → Environment Variables, add <code className="text-gray-300">SEC_USER_AGENT</code> = “Finance Home your@email.com”, then redeploy.</p>
        )}
      </div>
    )
  }

  const a = analyzeBusiness(state.data, price)
  if (!a) return <p className="text-sm text-gray-400 py-6 text-center">No annual financials found.</p>

  const chart = a.history.map(h => ({
    year: `FY${String(h.fiscalYear).slice(2)}`,
    Revenue: h.revenue !== null ? h.revenue / 1e9 : null,
    'Net income': h.netIncome !== null ? h.netIncome / 1e9 : null,
    'Free cash flow': h.freeCashFlow !== null ? h.freeCashFlow / 1e9 : null,
  }))

  return (
    <div className="space-y-4">
      {/* Scorecard */}
      <div className="bg-gray-800/60 rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-white font-semibold">
            {a.healthyCount} of {a.ratedCount} checks look healthy
          </p>
          <p className="text-[11px] text-gray-500 shrink-0">FY{a.fiscalYear} annual report</p>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${a.ratedCount ? (a.healthyCount / a.ratedCount) * 100 : 0}%` }} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {a.strengths.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-emerald-400 mb-1">Strengths</p>
              <ul className="space-y-0.5">{a.strengths.map(s => <li key={s} className="text-xs text-gray-300">• {s}</li>)}</ul>
            </div>
          )}
          {a.watchouts.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-amber-400 mb-1">Look into</p>
              <ul className="space-y-0.5">{a.watchouts.map(s => <li key={s} className="text-xs text-gray-300">• {s}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      {/* Revenue / profit / cash over the years */}
      {chart.length >= 2 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Revenue, profit & free cash flow ($ billions)</p>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={chart} barGap={2}>
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [fmtMoney(v * 1e9), n]} cursor={{ fill: '#ffffff08' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Net income" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Free cash flow" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sections — collapsed to keep it readable; dots summarize each */}
      <div className="space-y-2">
        {a.sections.map(sec => (
          <details key={sec.title} className="bg-gray-800/40 rounded-xl group">
            <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none">
              <span className="text-sm font-medium text-white">{sec.title}</span>
              <span className="text-xs text-gray-500 truncate flex-1">{sec.question}</span>
              <span className="flex gap-1 shrink-0">
                {sec.metrics.map(m => <span key={m.key} className={`w-1.5 h-1.5 rounded-full ${VERDICT_DOT[m.verdict]}`} />)}
              </span>
              <ChevronDown size={14} className="text-gray-500 transition-transform group-open:rotate-180 shrink-0" />
            </summary>
            <div className="px-3 pb-3 space-y-2.5">
              {sec.metrics.map(m => (
                <div key={m.key}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${VERDICT_DOT[m.verdict]}`} />{m.label}
                    </span>
                    <span className={`text-sm font-semibold ${VERDICT_TEXT[m.verdict]}`}>{m.display}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 pl-3">{m.note}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className="text-[11px] text-gray-600">
        From {a.name}'s SEC filings. Ratings use common rule-of-thumb ranges that differ by industry — a starting point for your own judgement, not a recommendation to buy or sell.
      </p>
    </div>
  )
}

// ── Price tab ──────────────────────────────────────────────────────────────

/** 1-year price chart with 50- and 200-day moving averages (real daily closes) */
function PriceChart({ history }: { history: PriceHistory }) {
  const { dates, closes } = history
  const rolling = (n: number, i: number) =>
    i + 1 >= n ? Math.round((closes.slice(i + 1 - n, i + 1).reduce((s, c) => s + c, 0) / n) * 100) / 100 : null
  const data = closes.map((c, i) => ({ date: dates[i], price: c, ma50: rolling(50, i), ma200: rolling(200, i) }))
  return (
    <>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30}
            tickFormatter={d => parseLocalDate(d).toLocaleDateString('en-US', { month: 'short' })} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={44}
            tickFormatter={v => `$${Math.round(v)}`} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={d => parseLocalDate(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            formatter={(v: number, name: string) => [formatCurrency(v), name]}
          />
          <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} dot={false} name="Price" isAnimationActive={false} />
          <Line type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.25} dot={false} name="50-day avg" connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="ma200" stroke="#10b981" strokeWidth={1.25} dot={false} name="200-day avg" connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500" /> Price</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500" /> 50-day avg</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500" /> 200-day avg</span>
      </div>
    </>
  )
}

const pctStr = (x: number | null) => (x === null ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`)

function PriceTab({ symbol, history, bench, weight }: {
  symbol: string
  history: PriceHistory | null
  bench: StockMetrics | null
  weight: number | null
}) {
  if (!history) {
    return <p className="text-sm text-gray-400 py-6 text-center">Price history loads from live market data on the deployed app.</p>
  }
  const m = analyzeStock(history, null)
  const tiles = [
    { label: '1 year', value: pctStr(m.return1Y), sub: bench?.return1Y != null ? `S&P ${pctStr(bench.return1Y)}` : '', tone: m.return1Y },
    { label: 'Swings / yr', value: m.volatility === null ? '—' : `${(m.volatility * 100).toFixed(0)}%`, sub: bench?.volatility ? `S&P ${(bench.volatility * 100).toFixed(0)}%` : '', tone: null },
    { label: 'Worst drop', value: pctStr(m.maxDrawdown), sub: 'peak to low', tone: null },
  ]
  return (
    <div className="space-y-4">
      <PriceChart history={history} />
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="bg-gray-800 rounded-xl p-2.5 text-center">
            <p className="text-[11px] text-gray-500">{t.label}</p>
            <p className={`text-sm font-bold ${t.tone === null ? 'text-white' : t.tone >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.value}</p>
            {t.sub && <p className="text-[10px] text-gray-600">{t.sub}</p>}
          </div>
        ))}
      </div>
      {m.rangePosition !== null && history.low52 !== null && history.high52 !== null && (
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>52-wk low {formatCurrency(history.low52)}</span><span>high {formatCurrency(history.high52)}</span>
          </div>
          <div className="relative h-1.5 bg-gray-800 rounded-full">
            <div className="absolute -top-1 w-3 h-3 rounded-full bg-brand-400 border-2 border-gray-900" style={{ left: `calc(${m.rangePosition * 100}% - 6px)` }} />
          </div>
        </div>
      )}
      <InsightList items={stockInsights(m, bench, weight, symbol)} />
      <p className="text-[11px] text-gray-600">Past prices describe risk — they don't predict where a stock goes next.</p>
    </div>
  )
}

// ── Wrapper ────────────────────────────────────────────────────────────────

export function CompanyAnalysis(props: {
  symbol: string
  price: number | null
  history: PriceHistory | null
  bench: StockMetrics | null
  /** Share of the user's portfolio (0–1), when owned */
  weight: number | null
}) {
  const [tab, setTab] = useState<'business' | 'price'>('business')
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs w-fit">
        {([['business', 'Business', Building2], ['price', 'Price & risk', LineIcon]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${tab === id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>
      {tab === 'business'
        ? <BusinessTab symbol={props.symbol} price={props.price} />
        : <PriceTab symbol={props.symbol} history={props.history} bench={props.bench} weight={props.weight} />}
    </div>
  )
}
