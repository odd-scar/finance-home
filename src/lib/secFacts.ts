/**
 * Turn SEC EDGAR "companyfacts" XBRL data into clean annual financials.
 *
 * Why this needs care:
 * - every 10-K repeats prior years, so the same period shows up many times
 * - 10-Ks also contain quarterly figures; only ~1-year periods are annual
 * - companies switch tags over time (e.g. "Revenues" → "RevenueFromContract…")
 * Used by api/fundamentals.ts; kept in src/ so it's type-checked and unit tested.
 */

export interface SecFact {
  start?: string
  end: string
  val: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

export interface CompanyFacts {
  entityName?: string
  facts?: Record<string, Record<string, { units?: Record<string, SecFact[]> }>>
}

export interface AnnualFinancials {
  /** Fiscal year end date (YYYY-MM-DD) */
  end: string
  fiscalYear: number
  revenue: number | null
  grossProfit: number | null
  costOfRevenue: number | null
  operatingIncome: number | null
  netIncome: number | null
  epsDiluted: number | null
  operatingCashFlow: number | null
  capex: number | null
  dividendsPaid: number | null
  interestExpense: number | null
  dilutedShares: number | null
  assets: number | null
  liabilities: number | null
  equity: number | null
  currentAssets: number | null
  currentLiabilities: number | null
  longTermDebt: number | null
  cash: number | null
}

export interface Fundamentals {
  symbol: string
  name: string
  cik: number
  /** Oldest → newest, up to 5 fiscal years */
  years: AnnualFinancials[]
  /** Latest reported shares outstanding (for market cap) */
  sharesOutstanding: number | null
  sharesOutstandingDate: string | null
  /** Bank / insurer / lender — cash-flow and liquidity ratios don't apply the usual way */
  isFinancial: boolean
}

// Line items only banks, lenders and insurers report
const FINANCIAL_MARKERS = [
  'Deposits', 'InterestAndDividendIncomeOperating', 'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss',
  'PolicyholderBenefitsAndClaimsIncurredNet', 'LiabilityForFuturePolicyBenefits', 'InterestIncomeExpenseNet',
]

const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '10-KT', '20-F', '40-F'])

// Candidate tags per line item, in order of preference
const TAGS = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet',
  ],
  grossProfit: ['GrossProfit'],
  costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  epsDiluted: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  dividendsPaid: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'],
  interestExpense: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: ['LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'],
} as const

type Field = keyof typeof TAGS
const DURATION_FIELDS = new Set<Field>([
  'revenue', 'grossProfit', 'costOfRevenue', 'operatingIncome', 'netIncome', 'epsDiluted', 'operatingCashFlow',
  'capex', 'dividendsPaid', 'interestExpense', 'dilutedShares',
])

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000

/**
 * Annual values for one tag, keyed by period end date. Durations must span ~1 year;
 * when a period appears in several filings, the most recently filed value wins
 * (it includes any restatement).
 */
function annualSeries(facts: SecFact[], duration: boolean): Map<string, number> {
  const best = new Map<string, SecFact>()
  for (const f of facts) {
    if (!f.form || !ANNUAL_FORMS.has(f.form) || typeof f.val !== 'number') continue
    if (duration) {
      if (!f.start) continue
      const span = days(f.start, f.end)
      if (span < 340 || span > 380) continue
    } else if (f.start) {
      continue
    }
    const prev = best.get(f.end)
    if (!prev || (f.filed ?? '') >= (prev.filed ?? '')) best.set(f.end, f)
  }
  return new Map([...best].map(([end, f]) => [end, f.val]))
}

function seriesFor(facts: CompanyFacts, field: Field): Map<string, number> {
  const gaap = facts.facts?.['us-gaap'] ?? {}
  const merged = new Map<string, number>()
  // Earlier tags in the list win; later ones only fill gaps (e.g. years before a rename)
  for (const tag of TAGS[field]) {
    const units = gaap[tag]?.units
    if (!units) continue
    const unitKey = field === 'epsDiluted' ? 'USD/shares' : field === 'dilutedShares' ? 'shares' : 'USD'
    const list = units[unitKey]
    if (!list) continue
    for (const [end, val] of annualSeries(list, DURATION_FIELDS.has(field))) {
      if (!merged.has(end)) merged.set(end, val)
    }
  }
  return merged
}

/** Pick the value whose end date is within a few days of the fiscal year end */
function near(series: Map<string, number>, end: string): number | null {
  if (series.has(end)) return series.get(end)!
  for (const [d, v] of series) if (Math.abs(days(d, end)) <= 7) return v
  return null
}

export function extractFundamentals(facts: CompanyFacts, symbol: string, cik: number, maxYears = 5): Fundamentals {
  const all = Object.fromEntries((Object.keys(TAGS) as Field[]).map(f => [f, seriesFor(facts, f)])) as Record<Field, Map<string, number>>

  // Fiscal years = periods with revenue or net income, newest last
  const ends = [...new Set([...all.revenue.keys(), ...all.netIncome.keys()])].sort()
  // Drop near-duplicate period ends (52/53-week years can differ by a few days across tags)
  const fiscalEnds: string[] = []
  for (const e of ends) {
    if (fiscalEnds.length && days(fiscalEnds[fiscalEnds.length - 1], e) < 300) fiscalEnds[fiscalEnds.length - 1] = e
    else fiscalEnds.push(e)
  }

  const years: AnnualFinancials[] = fiscalEnds.slice(-maxYears).map(end => {
    const row = { end, fiscalYear: Number(end.slice(0, 4)) } as AnnualFinancials
    for (const f of Object.keys(TAGS) as Field[]) row[f] = near(all[f], end)
    // Capex and dividends are reported as positive payments; keep them positive
    if (row.capex !== null) row.capex = Math.abs(row.capex)
    if (row.dividendsPaid !== null) row.dividendsPaid = Math.abs(row.dividendsPaid)
    // Some companies (e.g. Alphabet, Amazon) report cost of revenue but no gross profit line
    if (row.grossProfit === null && row.revenue !== null && row.costOfRevenue !== null) {
      row.grossProfit = row.revenue - row.costOfRevenue
    }
    return row
  })

  // Latest shares outstanding for market cap. Sources in order: the cover-page count,
  // then the balance-sheet count, then last year's diluted weighted average.
  const gaap = facts.facts?.['us-gaap'] ?? {}
  const shares =
    latestShareCount(facts.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares) ??
    latestShareCount(gaap.CommonStockSharesOutstanding?.units?.shares) ??
    (() => {
      const last = years[years.length - 1]
      return last?.dilutedShares ? { val: last.dilutedShares, end: last.end } : null
    })()

  // Banks/insurers have no gross profit or current assets and report lending/policy items
  const latest = years[years.length - 1]
  const isFinancial = FINANCIAL_MARKERS.some(t => gaap[t]) &&
    (latest ? latest.currentAssets === null && latest.grossProfit === null : true)

  return {
    symbol,
    name: facts.entityName ?? symbol,
    cik,
    years,
    sharesOutstanding: shares?.val ?? null,
    sharesOutstandingDate: shares?.end ?? null,
    isFinancial,
  }
}

/**
 * Most recent share count. Companies with several share classes (e.g. Alphabet A/B/C)
 * report one figure per class for the same date, so those are summed — taking each
 * class's figure from the latest filing for that date.
 */
function latestShareCount(list: SecFact[] | undefined): { val: number; end: string } | null {
  if (!list?.length) return null
  const latestEnd = list.reduce((m, f) => (f.end > m ? f.end : m), '')
  const onDate = list.filter(f => f.end === latestEnd)
  const latestFiled = onDate.reduce((m, f) => ((f.filed ?? '') > m ? f.filed ?? '' : m), '')
  const val = onDate.filter(f => (f.filed ?? '') === latestFiled).reduce((s, f) => s + f.val, 0)
  return val > 0 ? { val, end: latestEnd } : null
}
