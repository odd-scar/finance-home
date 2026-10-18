/**
 * Fundamental ("is this a good business, at what price?") analysis from annual
 * SEC financials plus the current share price.
 *
 * Ratings use common rule-of-thumb ranges. They're starting points for judgement,
 * not buy/sell signals — healthy ranges differ a lot by industry (a bank or a
 * utility looks nothing like a software company).
 */
import type { Fundamentals, AnnualFinancials } from './secFacts'

export type Verdict = 'good' | 'ok' | 'watch' | 'info'

export interface BusinessMetric {
  key: string
  label: string
  value: number | null
  display: string
  verdict: Verdict
  /** One plain-English line explaining what it means here */
  note: string
}

export interface BusinessSection {
  title: string
  question: string
  metrics: BusinessMetric[]
}

export interface BusinessAnalysis {
  name: string
  fiscalYear: number
  fiscalYearEnd: string
  marketCap: number | null
  sections: BusinessSection[]
  strengths: string[]
  watchouts: string[]
  /** Checks rated good / out of all rated checks */
  healthyCount: number
  ratedCount: number
  history: { fiscalYear: number; revenue: number | null; netIncome: number | null; freeCashFlow: number | null }[]
}

/** $416.2B, $93.7M, $512K */
export function fmtMoney(v: number | null): string {
  if (v === null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`
  return `${sign}$${a.toFixed(0)}`
}

const pct = (v: number | null, digits = 1) => (v === null || !isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`)
const signedPct = (v: number | null) => (v === null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`)
const ratio = (v: number | null, suffix = '') => (v === null || !isFinite(v) ? '—' : `${v.toFixed(1)}${suffix}`)
const div = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b)
const growth = (now: number | null, before: number | null) =>
  now === null || before === null || before <= 0 ? null : now / before - 1

/** Rate a value against thresholds: higher is better unless `lowerIsBetter` */
function rate(v: number | null, goodAt: number, okAt: number, lowerIsBetter = false): Verdict {
  if (v === null || !isFinite(v)) return 'info'
  if (lowerIsBetter) return v <= goodAt ? 'good' : v <= okAt ? 'ok' : 'watch'
  return v >= goodAt ? 'good' : v >= okAt ? 'ok' : 'watch'
}

const fcfOf = (y: AnnualFinancials) =>
  y.operatingCashFlow === null ? null : y.operatingCashFlow - (y.capex ?? 0)

export function analyzeBusiness(f: Fundamentals, price: number | null): BusinessAnalysis | null {
  const ys = f.years
  if (ys.length === 0) return null
  const y = ys[ys.length - 1]
  const prev = ys.length >= 2 ? ys[ys.length - 2] : null
  const first = ys[0]
  const spanYears = ys.length - 1

  // Market value = price × shares. Two guards against a wrong number:
  // - class-share tickers (BRK.B, BF.B): reported shares mix classes worth very different amounts
  // - if the implied P/E disagrees with price ÷ EPS by over 3×, the share count doesn't match the price
  let marketCap = price !== null && f.sharesOutstanding && !/[.\-]/.test(f.symbol) ? price * f.sharesOutstanding : null
  if (marketCap && price !== null && y.epsDiluted && y.epsDiluted > 0 && y.netIncome && y.netIncome > 0) {
    const ratioCheck = (marketCap / y.netIncome) / (price / y.epsDiluted)
    if (ratioCheck > 3 || ratioCheck < 1 / 3) marketCap = null
  }
  const fcf = fcfOf(y)

  // ── Growth ──
  const revGrowth = growth(y.revenue, prev?.revenue ?? null)
  const revCagr = spanYears >= 2 && y.revenue !== null && first.revenue !== null && first.revenue > 0
    ? Math.pow(y.revenue / first.revenue, 1 / spanYears) - 1
    : null
  const epsGrowth = growth(y.epsDiluted, prev?.epsDiluted ?? null)

  // ── Profitability ──
  const grossMargin = div(y.grossProfit, y.revenue)
  const opMargin = div(y.operatingIncome, y.revenue)
  const netMargin = div(y.netIncome, y.revenue)
  const avgEquity = y.equity !== null && prev?.equity != null ? (y.equity + prev.equity) / 2 : y.equity
  const roe = avgEquity !== null && avgEquity > 0 ? div(y.netIncome, avgEquity) : null

  // ── Cash ──
  const fcfMargin = div(fcf, y.revenue)
  const conversion = y.netIncome !== null && y.netIncome > 0 ? div(fcf, y.netIncome) : null

  // ── Health ── (a missing debt figure means "not reported", never "no debt")
  const currentRatio = div(y.currentAssets, y.currentLiabilities)
  const debtToEquity = y.equity !== null && y.equity > 0 ? div(y.longTermDebt, y.equity) : null
  const interestCover = y.interestExpense !== null && y.interestExpense > 0 ? div(y.operatingIncome, y.interestExpense) : null
  const netCash = y.cash !== null && y.longTermDebt !== null ? y.cash - y.longTermDebt : null

  // ── Valuation ──
  const pe = price !== null && y.epsDiluted !== null && y.epsDiluted > 0 ? price / y.epsDiluted : null
  const ps = div(marketCap, y.revenue)
  const fcfYield = marketCap ? div(fcf, marketCap) : null
  const pb = marketCap && y.equity !== null && y.equity > 0 ? marketCap / y.equity : null

  // Banks & insurers: operating cash flow swings with lending/deposits/claims, and they
  // have no "current" assets — those checks would mislead, so they're shown as context only
  const fin = f.isFinancial
  const finNote = 'Not meaningful for banks and insurers — their cash and debt work differently.'
  const finOnly = (m: BusinessMetric): BusinessMetric => (fin ? { ...m, verdict: 'info', display: '—', note: finNote } : m)

  // ── Shareholder returns ──
  const divYield = marketCap && y.dividendsPaid ? y.dividendsPaid / marketCap : marketCap ? 0 : null
  const shareChange = growth(y.dilutedShares, prev?.dilutedShares ?? null)

  const fy = `FY${y.fiscalYear}`
  const sections: BusinessSection[] = [
    {
      title: 'Growth',
      question: 'Is the business getting bigger?',
      metrics: [
        { key: 'revGrowth', label: 'Revenue growth', value: revGrowth, display: signedPct(revGrowth), verdict: rate(revGrowth, 0.1, 0),
          note: revGrowth === null ? 'Needs two years of revenue.' : revGrowth >= 0 ? `Sales grew vs the year before (${fmtMoney(y.revenue)} in ${fy}).` : `Sales shrank vs the year before (${fmtMoney(y.revenue)} in ${fy}).` },
        { key: 'revCagr', label: `Revenue growth / yr (${spanYears}y)`, value: revCagr, display: signedPct(revCagr), verdict: rate(revCagr, 0.1, 0),
          note: 'Average yearly growth — smooths out one good or bad year.' },
        { key: 'epsGrowth', label: 'Earnings per share growth', value: epsGrowth, display: signedPct(epsGrowth), verdict: rate(epsGrowth, 0.1, 0),
          note: epsGrowth === null ? 'Not meaningful when the prior year had no profit.' : 'Profit per share is what ultimately drives a stock over time.' },
      ],
    },
    {
      title: 'Profitability',
      question: 'Does it keep a good share of what it sells?',
      metrics: [
        { key: 'grossMargin', label: 'Gross margin', value: grossMargin, display: pct(grossMargin), verdict: rate(grossMargin, 0.4, 0.2),
          note: 'Kept from each sale after making the product. High margins often mean pricing power.' },
        { key: 'opMargin', label: 'Operating margin', value: opMargin, display: pct(opMargin), verdict: rate(opMargin, 0.15, 0.05),
          note: 'Kept after running the whole business (staff, marketing, R&D).' },
        { key: 'netMargin', label: 'Net margin', value: netMargin, display: pct(netMargin), verdict: rate(netMargin, 0.1, 0),
          note: netMargin !== null && netMargin < 0 ? 'The company lost money this year.' : 'Final profit per $1 of sales, after interest and taxes.' },
        { key: 'roe', label: 'Return on equity', value: roe, display: pct(roe),
          // Above 100% usually means equity has been shrunk by buybacks, not a super-business
          verdict: roe !== null && roe > 1 ? 'info' : rate(roe, 0.15, 0.08),
          note: roe === null && y.equity !== null && y.equity <= 0
            ? 'Not meaningful: shareholder equity is negative (often from large buybacks).'
            : roe !== null && roe > 1
              ? 'Inflated because years of buybacks shrank shareholder equity — compare margins and cash flow instead.'
              : 'Profit made on the money shareholders have in the business.' },
      ],
    },
    {
      title: 'Cash flow',
      question: 'Do the profits turn into real cash?',
      metrics: ([
        { key: 'fcf', label: 'Free cash flow', value: fcf, display: fmtMoney(fcf), verdict: fcf === null ? 'info' : fcf > 0 ? 'good' : 'watch',
          note: 'Cash left after running and reinvesting in the business — what can fund dividends, buybacks or paying down debt.' },
        { key: 'fcfMargin', label: 'Free cash flow margin', value: fcfMargin, display: pct(fcfMargin), verdict: rate(fcfMargin, 0.1, 0),
          note: 'Free cash per $1 of sales.' },
        { key: 'conversion', label: 'Cash vs reported profit', value: conversion, display: conversion === null ? '—' : `${(conversion * 100).toFixed(0)}%`, verdict: rate(conversion, 0.8, 0.5),
          note: 'Free cash flow as a share of net income. Well under 100% for years can mean profits are mostly on paper.' },
      ] as BusinessMetric[]).map(finOnly),
    },
    {
      title: 'Financial health',
      question: 'Could it survive a bad year?',
      metrics: ([
        { key: 'currentRatio', label: 'Current ratio', value: currentRatio, display: ratio(currentRatio, '×'), verdict: rate(currentRatio, 1.5, 1),
          note: 'Short-term assets vs bills due within a year. Under 1× is fine for cash-rich giants, riskier for small companies.' },
        { key: 'debtToEquity', label: 'Debt to equity', value: debtToEquity, display: ratio(debtToEquity, '×'), verdict: rate(debtToEquity, 0.5, 1.5, true),
          note: y.equity !== null && y.equity <= 0
            ? 'Not meaningful: shareholder equity is negative.'
            : y.longTermDebt === null
              ? 'Long-term debt isn’t reported in a standard way for this company.'
              : 'Long-term debt per $1 of shareholder equity. Lower means less risk if business slows.' },
        { key: 'interestCover', label: 'Interest coverage', value: interestCover, display: ratio(interestCover, '×'), verdict: rate(interestCover, 8, 3),
          note: interestCover === null
            ? 'Interest expense isn’t reported separately.'
            : interestCover < 0
              ? 'Operating loss — interest is being paid from cash or new funding, not profit.'
              : 'How many times operating profit covers interest payments.' },
        { key: 'netCash', label: 'Cash minus long-term debt', value: netCash, display: fmtMoney(netCash), verdict: netCash === null ? 'info' : netCash >= 0 ? 'good' : 'ok',
          note: netCash === null ? 'Needs both cash and long-term debt figures.'
            : netCash >= 0 ? 'More cash than long-term debt.' : 'More long-term debt than cash — normal for many companies; watch it against cash flow.' },
      ] as BusinessMetric[]).map(finOnly),
    },
    {
      title: 'Valuation',
      question: 'What are you paying for it?',
      metrics: [
        { key: 'marketCap', label: 'Market value', value: marketCap, display: fmtMoney(marketCap), verdict: 'info',
          note: marketCap === null
            ? 'Can’t be calculated reliably for this share class, so price-based ratios that need it are skipped.'
            : 'Share price × shares outstanding — the price tag on the whole company.' },
        { key: 'pe', label: `P/E (${fy} earnings)`, value: pe, display: ratio(pe, '×'),
          verdict: y.epsDiluted !== null && y.epsDiluted <= 0 ? 'watch' : rate(pe, 15, 30, true),
          note: y.epsDiluted !== null && y.epsDiluted <= 0
            ? 'No profit, so no P/E — you are paying for future hopes.'
            : pe === null ? 'Needs a share price and earnings.' : `You pay $${pe.toFixed(0)} for each $1 of yearly profit. The S&P 500 has averaged roughly 15–20×; higher prices assume strong growth.` },
        { key: 'ps', label: 'Price to sales', value: ps, display: ratio(ps, '×'), verdict: rate(ps, 2, 8, true),
          note: 'Market value per $1 of yearly sales. Useful when profits are small or negative.' },
        fin
          ? { key: 'pb', label: 'Price to book', value: pb, display: ratio(pb, '×'), verdict: rate(pb, 1.5, 3, true),
              note: 'Market value per $1 of shareholder equity — the usual yardstick for banks and insurers.' }
          : { key: 'fcfYield', label: 'Free cash flow yield', value: fcfYield, display: pct(fcfYield), verdict: rate(fcfYield, 0.05, 0.02),
              note: 'Free cash flow per $1 of market value — like an "earnings yield" based on cash.' },
      ],
    },
    {
      title: 'Shareholder returns',
      question: 'How does it reward owners?',
      metrics: [
        { key: 'divYield', label: 'Dividend yield', value: divYield, display: divYield === 0 ? 'None' : pct(divYield, 2), verdict: 'info',
          note: divYield ? 'Dividends paid last year per $1 of market value.' : 'No dividend — growth companies often reinvest or buy back shares instead.' },
        { key: 'shareChange', label: 'Share count change', value: shareChange, display: signedPct(shareChange), verdict: rate(shareChange, -0.01, 0.02, true),
          note: shareChange === null ? 'Needs two years of share counts.'
            : shareChange < 0 ? 'Fewer shares (buybacks) — each share owns more of the company.'
            : 'More shares (dilution) — each share owns a bit less of the company.' },
      ],
    },
  ]

  const rated = sections.flatMap(s => s.metrics).filter(m => m.verdict !== 'info')
  const lines = (v: Verdict) => rated.filter(m => m.verdict === v).map(m => `${m.label}: ${m.display}`)

  return {
    name: f.name,
    fiscalYear: y.fiscalYear,
    fiscalYearEnd: y.end,
    marketCap,
    sections,
    strengths: lines('good').slice(0, 4),
    watchouts: lines('watch').slice(0, 4),
    healthyCount: rated.filter(m => m.verdict === 'good').length,
    ratedCount: rated.length,
    history: ys.map(r => ({ fiscalYear: r.fiscalYear, revenue: r.revenue, netIncome: r.netIncome, freeCashFlow: fcfOf(r) })),
  }
}
