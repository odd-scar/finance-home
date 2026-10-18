/**
 * Descriptive stock & portfolio analysis from daily closing prices.
 *
 * Everything here describes the past (return, risk, drawdown, how a holding moves
 * with the market, how concentrated a portfolio is). None of it predicts prices —
 * short-term moves are close to random, so the app deliberately shows no forecasts.
 */

export interface PriceHistory {
  symbol: string
  name: string | null
  type: string | null
  price: number | null
  high52: number | null
  low52: number | null
  dates: string[]
  closes: number[]
}

/** US trading days in a year */
export const TRADING_DAYS = 252

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** Simple daily returns: c[t] / c[t−1] − 1 */
export function dailyReturns(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) out.push(closes[i] / closes[i - 1] - 1)
  return out
}

/** Return over the last `days` trading days, or null if there isn't that much history */
export function periodReturn(closes: number[], days: number): number | null {
  if (closes.length <= days) return null
  return closes[closes.length - 1] / closes[closes.length - 1 - days] - 1
}

/** Return over all available history (≈ 1 year from /api/history) */
export function totalReturn(closes: number[]): number | null {
  return closes.length >= 2 ? closes[closes.length - 1] / closes[0] - 1 : null
}

/** Annualized volatility: sample standard deviation of daily returns × √252 */
export function annualizedVolatility(returns: number[]): number | null {
  if (returns.length < 20) return null
  const m = mean(returns)
  const variance = returns.reduce((s, r) => s + (r - m) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS)
}

/** Largest peak-to-trough fall, as a negative fraction (−0.25 = fell 25% from a high) */
export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity
  let worst = 0
  for (const c of closes) {
    peak = Math.max(peak, c)
    worst = Math.min(worst, c / peak - 1)
  }
  return worst
}

/** Simple moving average of the last n closes */
export function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null
  return mean(closes.slice(-n))
}

/**
 * Beta and correlation vs a benchmark, using only days present in both series.
 * Beta 1 = moves with the market; 1.5 = tends to move 50% more; 0.5 = half as much.
 */
export function betaVs(
  a: Pick<PriceHistory, 'dates' | 'closes'>,
  b: Pick<PriceHistory, 'dates' | 'closes'>
): { beta: number; correlation: number } | null {
  const bByDate = new Map(b.dates.map((d, i) => [d, b.closes[i]]))
  const pairs: [number, number][] = []
  a.dates.forEach((d, i) => {
    const bc = bByDate.get(d)
    if (bc !== undefined) pairs.push([a.closes[i], bc])
  })
  if (pairs.length < 30) return null
  const ra: number[] = []
  const rb: number[] = []
  for (let i = 1; i < pairs.length; i++) {
    ra.push(pairs[i][0] / pairs[i - 1][0] - 1)
    rb.push(pairs[i][1] / pairs[i - 1][1] - 1)
  }
  const ma = mean(ra)
  const mb = mean(rb)
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb)
    va += (ra[i] - ma) ** 2
    vb += (rb[i] - mb) ** 2
  }
  if (vb === 0 || va === 0) return null
  return { beta: cov / vb, correlation: cov / Math.sqrt(va * vb) }
}

export interface StockMetrics {
  return1M: number | null
  return6M: number | null
  return1Y: number | null
  volatility: number | null
  maxDrawdown: number
  /** 0 = at 52-week low, 1 = at 52-week high */
  rangePosition: number | null
  /** How far below the 52-week high (negative fraction) */
  fromHigh: number | null
  sma50: number | null
  sma200: number | null
  beta: number | null
  isFund: boolean
}

export function analyzeStock(h: PriceHistory, benchmark?: PriceHistory | null): StockMetrics {
  const c = h.closes
  const price = h.price ?? c[c.length - 1] ?? null
  const hi = h.high52
  const lo = h.low52
  const bv = benchmark ? betaVs(h, benchmark) : null
  return {
    return1M: periodReturn(c, 21),
    return6M: periodReturn(c, 126),
    return1Y: totalReturn(c),
    volatility: annualizedVolatility(dailyReturns(c)),
    maxDrawdown: maxDrawdown(c),
    rangePosition: price !== null && hi !== null && lo !== null && hi > lo ? Math.min(1, Math.max(0, (price - lo) / (hi - lo))) : null,
    fromHigh: price !== null && hi ? price / hi - 1 : null,
    sma50: sma(c, 50),
    sma200: sma(c, 200),
    beta: bv ? bv.beta : null,
    isFund: h.type === 'ETF' || h.type === 'MUTUALFUND',
  }
}

// ── Portfolio ──────────────────────────────────────────────────────────────

export interface Holding {
  symbol: string
  value: number
}

export interface PortfolioMetrics {
  /** Largest single *company* holding share (0–1) — funds are already diversified */
  topWeight: number
  topSymbol: string | null
  /** 1 / Σw² — "acts like N equally-sized holdings" */
  effectiveHoldings: number
  /** Share of the portfolio in ETFs / funds */
  fundShare: number
  /** Today's mix, replayed over the past year (null without enough history) */
  return1Y: number | null
  volatility: number | null
  maxDrawdown: number | null
  beta: number | null
}

/**
 * Portfolio-level risk using today's weights applied to each holding's past daily
 * returns ("if you'd held this exact mix for the last year"). Holdings without
 * history are left out of the replay but still count toward concentration.
 */
export function analyzePortfolio(
  holdings: Holding[],
  histories: Record<string, PriceHistory | undefined>,
  benchmark?: PriceHistory | null,
  /** Extra fund detection (e.g. by name) for when price history hasn't loaded */
  isFundHint?: (symbol: string) => boolean
): PortfolioMetrics {
  const total = holdings.reduce((s, h) => s + h.value, 0)
  const isFund = (symbol: string) => {
    const t = histories[symbol]?.type
    return t === 'ETF' || t === 'MUTUALFUND' || !!isFundHint?.(symbol)
  }
  const weights = holdings.map(h => ({ ...h, w: total > 0 ? h.value / total : 0, fund: isFund(h.symbol) }))
  const top = weights
    .filter(h => !h.fund)
    .reduce<typeof weights[0] | null>((best, h) => (!best || h.w > best.w ? h : best), null)
  const hhi = weights.reduce((s, h) => s + h.w ** 2, 0)
  const fundShare = weights.filter(h => h.fund).reduce((s, h) => s + h.w, 0)

  // Replay: dates every included holding has, then weight their daily returns
  const withHist = weights.filter(h => (histories[h.symbol]?.closes.length ?? 0) > 30)
  let series: { dates: string[]; closes: number[] } | null = null
  if (withHist.length > 0) {
    const maps = withHist.map(h => {
      const hist = histories[h.symbol]!
      return new Map(hist.dates.map((d, i) => [d, hist.closes[i]]))
    })
    const common = histories[withHist[0].symbol]!.dates.filter(d => maps.every(m => m.has(d)))
    if (common.length > 30) {
      const wSum = withHist.reduce((s, h) => s + h.w, 0)
      const closes = [1]
      for (let i = 1; i < common.length; i++) {
        let r = 0
        withHist.forEach((h, k) => {
          r += (h.w / wSum) * (maps[k].get(common[i])! / maps[k].get(common[i - 1])! - 1)
        })
        closes.push(closes[i - 1] * (1 + r))
      }
      series = { dates: common, closes }
    }
  }

  const bv = series && benchmark ? betaVs(series, benchmark) : null
  return {
    topWeight: top?.w ?? 0,
    topSymbol: top?.symbol ?? null,
    effectiveHoldings: hhi > 0 ? 1 / hhi : 0,
    fundShare,
    return1Y: series ? totalReturn(series.closes) : null,
    volatility: series ? annualizedVolatility(dailyReturns(series.closes)) : null,
    maxDrawdown: series ? maxDrawdown(series.closes) : null,
    beta: bv ? bv.beta : null,
  }
}

// ── Plain-English notes ────────────────────────────────────────────────────

export type InsightTone = 'good' | 'warn' | 'info'
export interface Insight { tone: InsightTone; text: string }

const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

/** Context for one holding. `weight` is its share of the portfolio (0–1), if owned. */
export function stockInsights(m: StockMetrics, bench: StockMetrics | null, weight: number | null, symbol: string): Insight[] {
  const out: Insight[] = []
  if (weight !== null && weight > 0.2) {
    out.push({ tone: 'warn', text: `${symbol} is ${pct(weight)} of your portfolio. Many planners suggest keeping any single stock under about 10–20%.` })
  }
  if (m.isFund) out.push({ tone: 'good', text: 'This is a fund, so it already spreads your money across many companies.' })
  if (m.return1Y !== null && bench?.return1Y != null) {
    const diff = m.return1Y - bench.return1Y
    out.push({
      tone: 'info',
      // The gap between two returns is in percentage points, not percent
      text: `Past year: ${m.return1Y >= 0 ? '+' : ''}${pct(m.return1Y)} vs ${bench.return1Y >= 0 ? '+' : ''}${pct(bench.return1Y)} for the S&P 500 (${Math.abs(diff) < 0.01 ? 'about the same' : `${diff > 0 ? 'ahead' : 'behind'} by ${Math.round(Math.abs(diff) * 100)} percentage points`}).`,
    })
  }
  if (m.volatility !== null && bench?.volatility) {
    const ratio = m.volatility / bench.volatility
    if (ratio >= 1.5) out.push({ tone: 'warn', text: `Price swings are about ${ratio.toFixed(1)}× the S&P 500's — expect bigger ups and downs.` })
    else if (ratio <= 0.8) out.push({ tone: 'good', text: 'Price has been steadier than the S&P 500.' })
  }
  if (m.fromHigh !== null && m.fromHigh <= -0.2) {
    out.push({ tone: 'info', text: `${pct(-m.fromHigh)} below its 52-week high. A drop alone isn't a bargain signal — check why it fell.` })
  }
  if (m.maxDrawdown <= -0.3) {
    out.push({ tone: 'warn', text: `Fell as much as ${pct(-m.maxDrawdown)} from a peak this year. Could you hold through a drop like that?` })
  }
  if (m.sma200 !== null) {
    const last = m.sma50 ?? null
    if (last !== null) {
      out.push({
        tone: 'info',
        text: last >= m.sma200
          ? 'Its 50-day average is above its 200-day average — the longer-term trend has been up.'
          : 'Its 50-day average is below its 200-day average — the longer-term trend has been down.',
      })
    }
  }
  return out
}

export function portfolioInsights(p: PortfolioMetrics, bench: StockMetrics | null, holdingCount: number): Insight[] {
  const out: Insight[] = []
  if (holdingCount > 0 && p.topWeight > 0.2 && p.topSymbol) {
    out.push({ tone: 'warn', text: `${p.topSymbol} is ${pct(p.topWeight)} of your portfolio — a single company's bad news would hit hard.` })
  }
  // Funds count as many holdings, so only warn about a narrow mix of individual stocks
  if (holdingCount >= 2 && p.effectiveHoldings < 5 && p.fundShare < 0.25) {
    out.push({ tone: 'warn', text: `Your mix behaves like about ${p.effectiveHoldings.toFixed(1)} equal-sized stocks. Broad index funds are the simplest way to diversify.` })
  }
  if (p.fundShare >= 0.5) {
    out.push({ tone: 'good', text: `${pct(p.fundShare)} is in funds/ETFs, which gives you broad diversification.` })
  }
  if (p.volatility !== null && bench?.volatility) {
    const ratio = p.volatility / bench.volatility
    if (ratio >= 1.3) out.push({ tone: 'info', text: `Your portfolio swings about ${ratio.toFixed(1)}× as much as the S&P 500.` })
  }
  return out
}
