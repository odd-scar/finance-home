import { useState, useMemo } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { formatCurrency } from '../../utils/finance'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  BookOpen, CheckSquare, Square, ChevronDown, ChevronUp,
  Calculator, Lightbulb, Award, TrendingUp, Info,
} from 'lucide-react'

// ─── Static content ──────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  {
    id: 'emergency-fund',
    label: 'Build a 3–6 month emergency fund',
    detail: 'Before investing, make sure you have 3–6 months of living expenses saved in an easily accessible account. This is your financial safety net — it keeps you from having to sell investments during a rough patch.',
  },
  {
    id: 'high-interest-debt',
    label: 'Pay off high-interest debt first',
    detail: 'Credit cards charging 18–25% interest? Paying those off is a guaranteed 18–25% return. No investment reliably beats that. Focus here before putting money in the market.',
  },
  {
    id: 'budget-tracking',
    label: 'Set up a budget and track spending',
    detail: "You can't build wealth without knowing where your money goes. Even a rough budget helps you identify what you can invest each month. You're already doing this — you're ahead of most people.",
  },
  {
    id: 'brokerage-account',
    label: 'Open a brokerage account',
    detail: 'A brokerage account is your gateway to investing. Fidelity, Schwab, and Vanguard are popular low-cost options. Many have $0 minimums and no trading fees for ETFs.',
  },
  {
    id: 'index-funds',
    label: 'Start with index funds (e.g. S&P 500 ETFs)',
    detail: "Index funds like VOO or SPY track the entire S&P 500. Instead of picking individual stocks, you own tiny pieces of 500 large companies at once. They're low-cost, diversified, and historically strong performers.",
  },
  {
    id: 'auto-contributions',
    label: 'Set up automatic contributions',
    detail: "Automation removes the temptation to skip investing. Set up a recurring transfer — even $50/month — so it happens without you having to think about it. 'Pay yourself first' is the key principle.",
  },
  {
    id: 'quarterly-rebalance',
    label: 'Review and rebalance quarterly',
    detail: 'Once a quarter, check that your portfolio still matches your target allocation. If stocks ran up and are now 80% of your portfolio when you wanted 70%, sell a little and rebalance. This keeps your risk in check.',
  },
]

const CONCEPTS = [
  {
    id: 'compound-interest',
    title: 'Compound Interest',
    tagline: '"The 8th wonder of the world"',
    color: 'emerald',
    body: `Compound interest means your investment earnings generate their own earnings. A $1,000 investment earning 8%/year becomes $1,080 after year one — but then that $1,080 earns 8%, giving you $1,166.40. The gains snowball over time.\n\nThe key variables: how much you invest, how long you leave it, and your rate of return. Time is the most powerful of the three. Starting at 25 vs 35 can mean hundreds of thousands of dollars difference by retirement — without putting in more money.`,
  },
  {
    id: 'index-vs-stocks',
    title: 'Index Funds vs Individual Stocks',
    tagline: 'Diversification vs concentration',
    color: 'blue',
    body: `Individual stocks can make you rich — or wipe you out. A single company can go bankrupt, get disrupted, or just underperform for decades.\n\nIndex funds spread your risk across hundreds of companies. If one company tanks, it barely moves the needle. Studies consistently show that most professional fund managers fail to beat a simple S&P 500 index fund over 10+ years. Boring wins.`,
  },
  {
    id: 'dca',
    title: 'Dollar-Cost Averaging',
    tagline: 'Invest consistently, remove emotion',
    color: 'purple',
    body: `Dollar-cost averaging (DCA) means investing a fixed amount on a regular schedule — say, $200 every month — regardless of market conditions.\n\nWhen prices are high, your $200 buys fewer shares. When prices are low, it buys more. Over time, this averages out your purchase price and removes the stress of trying to "time the market." It's the strategy behind most 401(k) contributions.`,
  },
  {
    id: 'risk-tolerance',
    title: 'Risk Tolerance & Time Horizon',
    tagline: 'How much volatility can you stomach?',
    color: 'amber',
    body: `Risk tolerance is how much portfolio fluctuation you can handle emotionally and financially. If your portfolio drops 30% and you panic-sell, that's a problem — you locked in losses.\n\nYour time horizon matters: if you won't need the money for 20 years, a temporary drop is just noise. If you need it in 3 years, heavy stock exposure is risky.\n\nGeneral rule: the longer your horizon, the more risk (and potential reward) you can afford to take.`,
  },
  {
    id: 'tax-advantaged',
    title: 'Tax-Advantaged Accounts',
    tagline: '401k, IRA, Roth IRA — free money exists',
    color: 'rose',
    body: `401(k): Employer-sponsored, pre-tax contributions lower your taxable income today. If your employer matches contributions, that's an instant 50–100% return — always max the match.\n\nTraditional IRA: Similar to 401(k), pre-tax. Good if you expect to be in a lower tax bracket in retirement.\n\nRoth IRA: Contributions are after-tax, but growth and withdrawals in retirement are tax-FREE. Powerful for younger investors who expect income to grow over time. In 2025, you can contribute up to $7,000/year.`,
  },
  {
    id: 'diversification',
    title: 'Diversification',
    tagline: "Don't put all your eggs in one basket",
    color: 'teal',
    body: `Diversification means spreading investments across different asset types (stocks, bonds, real estate), sectors (tech, healthcare, energy), and geographies (US, international).\n\nThe goal: when one area underperforms, others may hold steady or rise. A diversified portfolio won't make you rich overnight, but it dramatically reduces the chance of catastrophic loss.`,
  },
  {
    id: '50-30-20',
    title: 'The 50/30/20 Rule',
    tagline: 'A simple budgeting framework',
    color: 'indigo',
    body: `A popular budgeting guideline:\n• 50% of after-tax income → needs (rent, groceries, utilities, minimum debt payments)\n• 30% → wants (dining out, entertainment, subscriptions)\n• 20% → savings and debt repayment\n\nIt's a starting point, not a strict law. In high cost-of-living areas, "needs" might take 60–70%. The principle is: know what you're spending, and make sure saving isn't an afterthought.`,
  },
  {
    id: 'emergency-fund-why',
    title: 'Emergency Fund Importance',
    tagline: 'Your first line of financial defense',
    color: 'orange',
    body: `An emergency fund is 3–6 months of living expenses in a liquid, low-risk account (like a high-yield savings account).\n\nWithout one, any unexpected expense — car repair, medical bill, job loss — forces you to either go into debt or liquidate investments at a bad time. Either outcome sets you back significantly.\n\nWith one, you can handle life's surprises without derailing your financial progress. It's not exciting, but it's foundational.`,
  },
]

const TIPS = [
  { emoji: '⏰', text: 'Time in the market beats timing the market. Every year you wait to invest is a year of compounding you lose forever.' },
  { emoji: '📉', text: "Don't check your portfolio every day. Markets fluctuate constantly — daily checking leads to anxiety and impulsive decisions." },
  { emoji: '🤖', text: 'Automate your investments. Set it and forget it. Money that moves automatically before you can spend it doesn\'t feel like a sacrifice.' },
  { emoji: '😱', text: 'Your biggest enemy is panic selling. Every major market crash in history has eventually recovered. Selling during a dip locks in your losses.' },
  { emoji: '🌱', text: 'Even $50/month invested in your 20s becomes significant by 40. At 8% annual return, $50/month for 20 years grows to ~$29,000.' },
  { emoji: '💸', text: "Fees matter more than you think. A 1% annual fee on a $100k portfolio costs you ~$100k over 30 years in lost compounding. Choose low-expense-ratio funds." },
  { emoji: '🎯', text: "Invest for your goals, not to beat the market. Most people need retirement income, not to outperform hedge funds. Keep it simple." },
  { emoji: '📊', text: "Boring is beautiful. A simple three-fund portfolio (US stocks, international stocks, bonds) has outperformed most 'sophisticated' strategies over time." },
  { emoji: '🔄', text: "Rebalancing once or twice a year is enough. Don't obsess. Set a target allocation, check quarterly, adjust annually." },
  { emoji: '💡', text: "Start before you're ready. You'll never feel 100% confident. Every month you delay costs you. A small imperfect investment beats a perfect plan that never happens." },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  dot: 'bg-purple-400' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    dot: 'bg-rose-400' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    dot: 'bg-teal-400' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  dot: 'bg-indigo-400' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  dot: 'bg-orange-400' },
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', border: '1px solid #374151',
  borderRadius: '8px', color: '#fff', fontSize: '12px',
}

// ─── Compound interest calculation ───────────────────────────────────────────

function calcCompound(monthly: number, years: number, annualRate: number, lump = 0) {
  const r = annualRate / 100 / 12
  const n = years * 12
  const fvContrib = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n
  const fvLump = lump * Math.pow(1 + r, n)
  return fvContrib + fvLump
}

function buildCompoundData(monthly: number, years: number, annualRate: number, lump = 0) {
  const r = annualRate / 100 / 12
  const data: { year: number; balance: number; contributed: number }[] = []
  for (let yr = 1; yr <= years; yr++) {
    const n = yr * 12
    const fvC = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n
    const fvL = lump * Math.pow(1 + r, n)
    data.push({ year: yr, balance: Math.round(fvC + fvL), contributed: Math.round(monthly * n + lump) })
  }
  return data
}

// ─── Debt payoff calculation ──────────────────────────────────────────────────

function calcDebtPayoff(balance: number, annualRate: number, monthlyPayment: number) {
  if (monthlyPayment <= 0 || balance <= 0) return null
  const r = annualRate / 100 / 12
  if (r === 0) {
    const months = Math.ceil(balance / monthlyPayment)
    return { months, totalInterest: 0 }
  }
  const minPayment = balance * r
  if (monthlyPayment <= minPayment) return null // never pays off
  const months = Math.ceil(-Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r))
  let remaining = balance, totalInterest = 0
  for (let i = 0; i < months; i++) {
    const interest = remaining * r
    totalInterest += interest
    remaining = Math.max(0, remaining + interest - monthlyPayment)
  }
  return { months, totalInterest: Math.round(totalInterest) }
}

// ─── Main component ───────────────────────────────────────────────────────────

type Section = 'checklist' | 'concepts' | 'calculators' | 'tips'

export function Learn() {
  const { savings, debts, stocks, budget } = useAppStore()

  const [activeSection, setActiveSection] = useState<Section>('checklist')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('learn-checklist')
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null)
  const [expandedTip, setExpandedTip] = useState<string | null>(null)

  // Compound interest calculator
  const [ciMonthly, setCiMonthly] = useState('200')
  const [ciLump, setCiLump] = useState('0')
  const [ciYears, setCiYears] = useState('20')
  const [ciRate, setCiRate] = useState('8')

  // Debt payoff calculator
  const [dpBalance, setDpBalance] = useState('5000')
  const [dpRate, setDpRate] = useState('19.99')
  const [dpPayment, setDpPayment] = useState('200')

  // Active calculator tab
  const [calcTab, setCalcTab] = useState<'compound' | 'debt' | 'networth'>('compound')

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('learn-checklist', JSON.stringify([...next])) } catch { /* quota */ }
      return next
    })
  }

  const toggleConcept = (id: string) =>
    setExpandedConcept(prev => prev === id ? null : id)

  // ── Badge logic ────────────────────────────────────────────────────────
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear  = now.getFullYear()

  const emergencyFundBalance = savings
    .filter(s => s.category === 'emergency')
    .reduce((sum, s) => sum + s.balance, 0)

  const monthlyExpenses = budget
    .filter(b => b.month === curMonth && b.year === curYear && b.type === 'expense')
    .reduce((sum, b) => sum + b.amount, 0)

  const portfolioStocks = stocks.filter(s => !s.watchlist)
  const portfolioValue = portfolioStocks.reduce((sum, s) => sum + s.shares * s.currentPrice, 0)
  const creditCardDebt = debts.filter(d => d.type === 'credit_card')
  const hasAnyCcDebt = creditCardDebt.some(d => d.balance > 0)

  const badges = [
    {
      id: 'ef-started',
      label: 'Emergency Fund Started',
      desc: 'You have some money set aside in an emergency savings account.',
      earned: emergencyFundBalance > 0,
      color: 'emerald',
    },
    {
      id: 'first-investment',
      label: 'First Investment Made',
      desc: 'You own at least one stock or ETF in your portfolio.',
      earned: portfolioStocks.length > 0,
      color: 'blue',
    },
    {
      id: 'cc-free',
      label: 'Credit Card Debt-Free',
      desc: "You have no outstanding credit card balances. That's a huge deal.",
      earned: creditCardDebt.length > 0 && !hasAnyCcDebt,
      color: 'rose',
    },
    {
      id: 'ef-3month',
      label: '3-Month Emergency Fund',
      desc: 'Your emergency fund covers at least 3 months of expenses.',
      earned: monthlyExpenses > 0 && emergencyFundBalance >= monthlyExpenses * 3,
      color: 'amber',
    },
  ]

  // ── Net worth snapshot ─────────────────────────────────────────────────
  const savingsTotal = savings.reduce((s, a) => s + a.balance, 0)
  const assetsTotal  = useAppStore().assets.reduce((s, a) => s + a.value, 0)
  const debtsTotal   = debts.reduce((s, d) => s + d.balance, 0)
  const netWorth     = savingsTotal + portfolioValue + assetsTotal - debtsTotal

  // ── Compound interest data ─────────────────────────────────────────────
  const ciData = useMemo(() => {
    const m = parseFloat(ciMonthly) || 0
    const y = Math.max(1, Math.min(50, parseInt(ciYears) || 20))
    const r = parseFloat(ciRate) || 0
    const l = parseFloat(ciLump) || 0
    return buildCompoundData(m, y, r, l)
  }, [ciMonthly, ciYears, ciRate, ciLump])

  const ciFinal = ciData[ciData.length - 1]?.balance ?? 0
  const ciContrib = ciData[ciData.length - 1]?.contributed ?? 0

  // ── Debt payoff result ─────────────────────────────────────────────────
  const dpResult = useMemo(() => {
    const b = parseFloat(dpBalance) || 0
    const r = parseFloat(dpRate) || 0
    const p = parseFloat(dpPayment) || 0
    return calcDebtPayoff(b, r, p)
  }, [dpBalance, dpRate, dpPayment])

  const numChecked = CHECKLIST_ITEMS.filter(item => checkedItems.has(item.id)).length
  const checklistPct = Math.round((numChecked / CHECKLIST_ITEMS.length) * 100)

  const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'checklist',   label: 'Checklist',  icon: <CheckSquare size={15} /> },
    { id: 'concepts',    label: 'Concepts',   icon: <BookOpen size={15} /> },
    { id: 'calculators', label: 'Calculators', icon: <Calculator size={15} /> },
    { id: 'tips',        label: 'Tips',       icon: <Lightbulb size={15} /> },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in pb-32 lg:pb-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-brand-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Investor Guide</h2>
          <p className="text-sm text-gray-400">Your friendly companion for building wealth — no jargon, no lectures.</p>
        </div>
      </div>

      {/* ── Badges ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {badges.map(badge => {
          const c = COLOR_MAP[badge.color] ?? COLOR_MAP.emerald
          return (
            <div
              key={badge.id}
              title={badge.desc}
              className={`relative rounded-xl p-3 border transition-all ${
                badge.earned
                  ? `${c.bg} ${c.border}`
                  : 'bg-gray-900 border-gray-800 opacity-50 grayscale'
              }`}
            >
              <Award size={18} className={badge.earned ? c.text : 'text-gray-600'} />
              <p className={`text-xs font-semibold mt-1.5 leading-snug ${badge.earned ? 'text-white' : 'text-gray-500'}`}>
                {badge.label}
              </p>
              {badge.earned && (
                <span className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${c.dot}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Section nav ───────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
              activeSection === s.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {s.icon}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════ CHECKLIST ════════════════════════════════════════ */}
      {activeSection === 'checklist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Getting Started Checklist</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {numChecked} of {CHECKLIST_ITEMS.length} completed
              </p>
            </div>
            {/* Progress ring indicator */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#1f2937" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={checklistPct === 100 ? '#10b981' : '#4f46e5'} strokeWidth="3"
                  strokeDasharray={`${(checklistPct / 100) * 94.25} 94.25`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {checklistPct}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {CHECKLIST_ITEMS.map(item => {
              const checked = checkedItems.has(item.id)
              const isOpen  = expandedTip === item.id
              return (
                <div
                  key={item.id}
                  className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                    checked ? 'border-emerald-500/30' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.id)}
                      className={`shrink-0 mt-0.5 transition-colors ${checked ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${checked ? 'text-gray-400 line-through' : 'text-white'}`}>
                        {item.label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedTip(prev => prev === item.id ? null : item.id)}
                      className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      {isOpen ? <ChevronUp size={15} /> : <Info size={15} />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-800 pt-3">
                        {item.detail}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {numChecked === CHECKLIST_ITEMS.length && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
              <p className="text-emerald-400 font-semibold text-sm">All done! You're on solid financial footing.</p>
              <p className="text-xs text-gray-400 mt-1">Keep investing consistently and let time do the heavy lifting.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ CONCEPTS ═════════════════════════════════════════ */}
      {activeSection === 'concepts' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Tap any card to expand and learn more.</p>
          {CONCEPTS.map(concept => {
            const c = COLOR_MAP[concept.color] ?? COLOR_MAP.emerald
            const isOpen = expandedConcept === concept.id
            return (
              <div
                key={concept.id}
                className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                  isOpen ? `${c.border}` : 'border-gray-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleConcept(concept.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{concept.title}</p>
                    <p className={`text-xs mt-0.5 ${c.text}`}>{concept.tagline}</p>
                  </div>
                  <span className="text-gray-500 shrink-0">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 pt-0">
                    <div className={`h-px ${c.bg} mb-4`} style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    {concept.body.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm text-gray-300 leading-relaxed mb-3 last:mb-0">
                        {para}
                      </p>
                    ))}
                    {/* Inline compound interest chart for the compound concept */}
                    {concept.id === 'compound-interest' && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-3">
                          Example: $200/month at 8% annual return over 30 years
                        </p>
                        <ResponsiveContainer width="100%" height={140}>
                          <AreaChart data={buildCompoundData(200, 30, 8, 0)}>
                            <defs>
                              <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Years', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
                            <Area type="monotone" dataKey="balance" stroke="#10b981" fill="url(#cgGrad)" name="Portfolio Value" />
                            <Area type="monotone" dataKey="contributed" stroke="#4f46e5" fill="none" strokeDasharray="4 2" name="Amount Invested" />
                          </AreaChart>
                        </ResponsiveContainer>
                        <p className="text-[11px] text-gray-600 mt-2">Dashed line = total invested. Solid line = portfolio value including growth.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════ CALCULATORS ══════════════════════════════════════ */}
      {activeSection === 'calculators' && (
        <div className="space-y-4">
          {/* Calculator tabs */}
          <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl">
            {([
              { id: 'compound', label: 'Compound Growth' },
              { id: 'debt',     label: 'Debt Payoff' },
              { id: 'networth', label: 'Net Worth' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCalcTab(tab.id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  calcTab === tab.id
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Compound Interest Calculator ── */}
          {calcTab === 'compound' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-white">Compound Growth Calculator</h3>
                <p className="text-xs text-gray-500 mt-0.5">See how small, consistent investing adds up over time.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Monthly contribution ($)</label>
                  <input
                    type="number"
                    value={ciMonthly}
                    onChange={e => setCiMonthly(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Lump sum to start ($)</label>
                  <input
                    type="number"
                    value={ciLump}
                    onChange={e => setCiLump(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Years</label>
                  <input
                    type="number"
                    value={ciYears}
                    onChange={e => setCiYears(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Annual return (%)</label>
                  <input
                    type="number"
                    value={ciRate}
                    onChange={e => setCiRate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
              </div>

              {/* Result summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total invested</p>
                  <p className="text-sm font-bold text-gray-200">{formatCurrency(ciContrib)}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Portfolio value</p>
                  <p className="text-sm font-bold text-emerald-400">{formatCurrency(ciFinal)}</p>
                </div>
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Gains</p>
                  <p className="text-sm font-bold text-brand-400">{formatCurrency(Math.max(0, ciFinal - ciContrib))}</p>
                </div>
              </div>

              {/* Chart */}
              {ciData.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={ciData}>
                    <defs>
                      <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v)]} />
                    <Area type="monotone" dataKey="balance" stroke="#10b981" fill="url(#ciGrad)" name="Portfolio Value" />
                    <Area type="monotone" dataKey="contributed" stroke="#4f46e5" fill="none" strokeDasharray="4 2" name="Amount Invested" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── Debt Payoff Calculator ── */}
          {calcTab === 'debt' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-white">Debt Payoff Calculator</h3>
                <p className="text-xs text-gray-500 mt-0.5">See exactly when you'll be debt-free and how much interest you'll pay.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Balance ($)</label>
                  <input
                    type="number"
                    value={dpBalance}
                    onChange={e => setDpBalance(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Interest rate (%/yr)</label>
                  <input
                    type="number"
                    value={dpRate}
                    onChange={e => setDpRate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Monthly payment ($)</label>
                  <input
                    type="number"
                    value={dpPayment}
                    onChange={e => setDpPayment(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-600 transition-colors"
                  />
                </div>
              </div>

              {dpResult ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Time to pay off</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {dpResult.months < 12
                        ? `${dpResult.months} mo`
                        : `${Math.floor(dpResult.months / 12)} yr${dpResult.months % 12 ? ` ${dpResult.months % 12} mo` : ''}`}
                    </p>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total interest paid</p>
                    <p className="text-lg font-bold text-rose-400">{formatCurrency(dpResult.totalInterest)}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-400">
                    {parseFloat(dpPayment) <= 0
                      ? 'Enter a monthly payment to see the payoff timeline.'
                      : 'Your monthly payment is too low to cover the interest — the debt would grow. Try increasing your payment.'}
                  </p>
                </div>
              )}

              {dpResult && (
                <p className="text-xs text-gray-600">
                  Tip: Even paying an extra $25–50/month can shave months off this timeline and save significant interest.
                </p>
              )}
            </div>
          )}

          {/* ── Net Worth Snapshot ── */}
          {calcTab === 'networth' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-white">Net Worth Snapshot</h3>
                <p className="text-xs text-gray-500 mt-0.5">Auto-filled from your app data.</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'Savings accounts', value: savingsTotal, positive: true },
                  { label: 'Investment portfolio', value: portfolioValue, positive: true },
                  { label: 'Physical assets', value: assetsTotal, positive: true },
                  { label: 'Total debt', value: debtsTotal, positive: false },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <p className="text-sm text-gray-400">{row.label}</p>
                    <p className={`text-sm font-semibold ${row.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.positive ? '+' : '-'}{formatCurrency(row.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className={`rounded-xl p-4 text-center ${
                netWorth >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'
              }`}>
                <p className="text-xs text-gray-500 mb-1">Your Net Worth</p>
                <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netWorth >= 0 ? '+' : ''}{formatCurrency(netWorth)}
                </p>
                {netWorth < 0 && (
                  <p className="text-xs text-gray-500 mt-2">Negative net worth is common early in life — student loans, car loans, etc. The trend over time is what matters.</p>
                )}
              </div>

              <p className="text-xs text-gray-600">
                Net worth = all assets (savings + investments + physical assets) minus all debts. Track it over time — a rising net worth means you're building wealth.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TIPS ═════════════════════════════════════════════ */}
      {activeSection === 'tips' && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Early Investor Tips</p>
            <p className="text-xs text-gray-500 mt-0.5">Plain-language wisdom from people who've been doing this for a while.</p>
          </div>
          <div className="space-y-2">
            {TIPS.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <span className="text-xl shrink-0 leading-none mt-0.5">{tip.emoji}</span>
                <p className="text-sm text-gray-300 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
          <div className="bg-brand-600/10 border border-brand-600/20 rounded-xl p-4 text-center mt-4">
            <TrendingUp size={20} className="text-brand-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">The best time to start was yesterday.</p>
            <p className="text-xs text-gray-400 mt-1">The second best time is today. Even small amounts, invested consistently, change your future.</p>
          </div>
        </div>
      )}
    </div>
  )
}
