import { describe, it, expect } from 'vitest'
import {
  dailyReturns, periodReturn, annualizedVolatility, maxDrawdown, sma, betaVs, analyzePortfolio,
  type PriceHistory,
} from '../stockAnalysis'
import { extractFundamentals, type CompanyFacts, type SecFact } from '../secFacts'
import { analyzeBusiness } from '../businessAnalysis'

// ── Price math ─────────────────────────────────────────────────────────────

const dates = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2025, 0, 1 + i))
  return d.toISOString().slice(0, 10)
})
const hist = (symbol: string, closes: number[], type = 'EQUITY'): PriceHistory => ({
  symbol, name: symbol, type, price: closes[closes.length - 1], high52: Math.max(...closes), low52: Math.min(...closes),
  dates: dates(closes.length), closes,
})

describe('price math', () => {
  it('returns, drawdown and moving average', () => {
    expect(dailyReturns([100, 110, 99])).toEqual([0.10000000000000009, -0.09999999999999998])
    expect(periodReturn([100, 105, 120], 2)).toBeCloseTo(0.2)
    expect(periodReturn([100, 120], 5)).toBeNull()
    // Peak 120 → trough 90 = −25%
    expect(maxDrawdown([100, 120, 90, 110])).toBeCloseTo(-0.25)
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5)
  })

  it('annualizes volatility with √252', () => {
    // Alternating +1% / −1% → daily stdev ≈ 1% → ≈ 15.9% a year
    const closes = [100]
    for (let i = 0; i < 60; i++) closes.push(closes[i] * (i % 2 ? 0.99 : 1.01))
    expect(annualizedVolatility(dailyReturns(closes))!).toBeCloseTo(0.01 * Math.sqrt(252), 2)
  })

  it('beta: a stock that moves 2× the market has beta 2 and correlation 1', () => {
    const market = [100]
    const stock = [100]
    for (let i = 0; i < 60; i++) {
      const r = (i % 3 === 0 ? 0.01 : -0.004)
      market.push(market[i] * (1 + r))
      stock.push(stock[i] * (1 + 2 * r))
    }
    const b = betaVs(hist('X', stock), hist('SPY', market))!
    expect(b.beta).toBeCloseTo(2)
    expect(b.correlation).toBeCloseTo(1)
  })

  it('portfolio concentration and fund share', () => {
    const p = analyzePortfolio(
      [{ symbol: 'AAA', value: 6000 }, { symbol: 'VOO', value: 2000 }, { symbol: 'BBB', value: 2000 }],
      { VOO: hist('VOO', Array(40).fill(0).map((_, i) => 100 + i), 'ETF') }
    )
    expect(p.topSymbol).toBe('AAA')
    expect(p.topWeight).toBeCloseTo(0.6)
    // 1 / (0.36 + 0.04 + 0.04)
    expect(p.effectiveHoldings).toBeCloseTo(1 / 0.44)
    expect(p.fundShare).toBeCloseTo(0.2)
  })
})

// ── SEC extraction ─────────────────────────────────────────────────────────

const annual = (fy: number, val: number, extra: Partial<SecFact> = {}): SecFact => ({
  start: `${fy - 1}-10-01`, end: `${fy}-09-30`, val, fy, fp: 'FY', form: '10-K', filed: `${fy}-11-01`, ...extra,
})
const instant = (fy: number, val: number): SecFact => ({ end: `${fy}-09-30`, val, fy, fp: 'FY', form: '10-K', filed: `${fy}-11-01` })

const facts: CompanyFacts = {
  entityName: 'Test Co',
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: { units: { shares: [
        { end: '2025-10-15', val: 60, form: '10-K', filed: '2025-11-01' },
        { end: '2025-10-15', val: 40, form: '10-K', filed: '2025-11-01' }, // second share class
      ] } },
    },
    'us-gaap': {
      // Older years under "Revenues", newer under the post-2018 tag — must merge
      Revenues: { units: { USD: [annual(2022, 800)] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
        annual(2023, 900),
        annual(2024, 1000),
        // A later 10-K repeating 2024 (restated) — newest filing wins
        annual(2024, 1010, { filed: '2025-11-01', fy: 2025 }),
        annual(2025, 1200),
        // Quarterly figure inside a 10-K — must be ignored
        { start: '2025-07-01', end: '2025-09-30', val: 350, form: '10-K', fp: 'FY', filed: '2025-11-01' },
      ] } },
      CostOfRevenue: { units: { USD: [annual(2025, 480)] } },
      OperatingIncomeLoss: { units: { USD: [annual(2025, 300)] } },
      NetIncomeLoss: { units: { USD: [annual(2024, 150), annual(2025, 240)] } },
      EarningsPerShareDiluted: { units: { 'USD/shares': [annual(2024, 1.5), annual(2025, 2.4)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [annual(2025, 280)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [annual(2025, 40)] } },
      StockholdersEquity: { units: { USD: [instant(2024, 900), instant(2025, 1100)] } },
      AssetsCurrent: { units: { USD: [instant(2025, 600)] } },
      LiabilitiesCurrent: { units: { USD: [instant(2025, 300)] } },
      LongTermDebt: { units: { USD: [instant(2025, 500)] } },
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [instant(2025, 200)] } },
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [annual(2024, 102), annual(2025, 100)] } },
    },
  },
}

describe('extractFundamentals', () => {
  const f = extractFundamentals(facts, 'TEST', 123)

  it('builds one row per fiscal year, merging renamed revenue tags', () => {
    expect(f.years.map(y => y.fiscalYear)).toEqual([2022, 2023, 2024, 2025])
    expect(f.years.map(y => y.revenue)).toEqual([800, 900, 1010, 1200]) // restated 2024, no quarterly 350
  })

  it('derives gross profit from cost of revenue when not reported', () => {
    expect(f.years[3].grossProfit).toBe(720)
  })

  it('sums share classes for shares outstanding', () => {
    expect(f.sharesOutstanding).toBe(100)
    expect(f.isFinancial).toBe(false)
  })
})

describe('analyzeBusiness', () => {
  const f = extractFundamentals(facts, 'TEST', 123)
  const a = analyzeBusiness(f, 48)! // price $48 × 100 shares → market cap $4,800
  const m = Object.fromEntries(a.sections.flatMap(s => s.metrics).map(x => [x.key, x]))

  it('computes the standard ratios', () => {
    expect(m.revGrowth.value).toBeCloseTo(1200 / 1010 - 1)
    expect(m.revCagr.value).toBeCloseTo(Math.pow(1200 / 800, 1 / 3) - 1)
    expect(m.grossMargin.value).toBeCloseTo(0.6)
    expect(m.opMargin.value).toBeCloseTo(0.25)
    expect(m.netMargin.value).toBeCloseTo(0.2)
    expect(m.roe.value).toBeCloseTo(240 / 1000) // average equity (900 + 1100) / 2
    expect(m.fcf.value).toBe(240)                // 280 − 40
    expect(m.currentRatio.value).toBeCloseTo(2)
    expect(m.debtToEquity.value).toBeCloseTo(500 / 1100)
    expect(m.netCash.value).toBe(-300)
    expect(m.pe.value).toBeCloseTo(20)          // 48 / 2.4
    expect(m.fcfYield.value).toBeCloseTo(240 / 4800)
    expect(m.ps.value).toBeCloseTo(4800 / 1200)
    expect(m.shareChange.value).toBeCloseTo(100 / 102 - 1)
  })

  it('treats a missing debt figure as "not reported", never as zero debt', () => {
    const noDebt = { ...f, years: f.years.map(y => ({ ...y, longTermDebt: null })) }
    const mm = Object.fromEntries(analyzeBusiness(noDebt, 48)!.sections.flatMap(s => s.metrics).map(x => [x.key, x]))
    expect(mm.debtToEquity.value).toBeNull()
    expect(mm.netCash.value).toBeNull()
  })

  it('skips market value when the share count does not match the price', () => {
    // 1000× too many shares → implied P/E far from price ÷ EPS
    const bad = analyzeBusiness({ ...f, sharesOutstanding: 1_000_000 }, 48)!
    expect(bad.marketCap).toBeNull()
    // Class-share tickers never get a computed market value
    expect(analyzeBusiness({ ...f, symbol: 'BRK.B' }, 48)!.marketCap).toBeNull()
  })

  it('marks cash-flow and liquidity checks as not meaningful for banks', () => {
    const bank = analyzeBusiness({ ...f, isFinancial: true }, 48)!
    const mm = Object.fromEntries(bank.sections.flatMap(s => s.metrics).map(x => [x.key, x]))
    expect(mm.fcf.verdict).toBe('info')
    expect(mm.currentRatio.verdict).toBe('info')
    expect(mm.pb).toBeDefined()
  })
})
