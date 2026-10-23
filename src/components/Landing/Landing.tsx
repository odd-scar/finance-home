/**
 * Public landing page — the first thing a signed-out visitor sees.
 *
 * The pitch is clarity, not control: this app shows you how your money moves,
 * it does not move it. Everything claimed here is something the app actually
 * does; if a feature changes, change the wording with it.
 */
import { useState } from 'react'
import {
  DollarSign, Eye, TrendingUp, Compass, Wallet, Receipt, PiggyBank, Target,
  CreditCard, LineChart, Plane, Lock, WifiOff, ShieldCheck, Check, X, ArrowRight,
  LayoutDashboard, Home, Repeat, Shield, Cloud,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { PrivacyAndTerms } from '../Legal/Legal'

interface LandingProps {
  /** Open the sign-in / sign-up screen */
  onGetStarted: () => void
}

const pillars = [
  {
    icon: <Eye size={20} />,
    title: 'Know where you stand',
    body: 'One screen for the month: what came in, what is already spoken for, and what is actually left. No guessing, no spreadsheet.',
  },
  {
    icon: <TrendingUp size={20} />,
    title: 'Watch your savings grow',
    body: 'Log a balance and it is kept. Over months you stop seeing a number and start seeing a line that goes up.',
  },
  {
    icon: <Compass size={20} />,
    title: 'Know where you are going',
    body: 'Goals, debt payoff order, and trip budgets — so "can I afford this?" has an answer instead of a feeling.',
  },
]

const features = [
  { icon: <Wallet size={17} />,    name: 'Budget',       body: 'Fixed bills and flexible spending, planned against actual. Quick log accepts maths like 12+8.' },
  { icon: <Receipt size={17} />,   name: 'Bills',        body: 'Recurring bills with due dates, so nothing arrives as a surprise.' },
  { icon: <PiggyBank size={17} />, name: 'Savings',      body: 'Accounts with history, so growth is visible over time.' },
  { icon: <Target size={17} />,    name: 'Goals',        body: 'Set a target, track what is left, see what it takes each month.' },
  { icon: <CreditCard size={17} />,name: 'Debt',         body: 'Compare avalanche and snowball payoff and pick an order.' },
  { icon: <LineChart size={17} />, name: 'Stocks',       body: 'Holdings and a watchlist with live quotes and company fundamentals.' },
  { icon: <Plane size={17} />,     name: 'Trip Planner', body: 'Budget a trip line by line before you commit to it.' },
  { icon: <WifiOff size={17} />,   name: 'Works offline',body: 'Installs to your phone and keeps working without signal. Syncs when you are back.' },
]

const notThis = [
  'It never connects to your bank, and never asks for bank logins.',
  'It does not move, hold, send or invest a single dollar.',
  'It is not financial advice — it is a clear view and a calculator.',
]

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`px-4 sm:px-6 ${className}`}><div className="max-w-5xl mx-auto">{children}</div></section>
}

/** Mini sidebar entries — the real nav, trimmed to fit the preview */
const previewNav = [
  { icon: <LayoutDashboard size={13} />, label: 'Dashboard' },
  { icon: <PiggyBank size={13} />,       label: 'Savings' },
  { icon: <Receipt size={13} />,         label: 'Bills', active: true },
  { icon: <Wallet size={13} />,          label: 'Budget' },
  { icon: <Target size={13} />,          label: 'Goals' },
]

const previewStats = [
  { label: 'Monthly',  value: '$1,840', tone: 'text-white' },
  { label: 'Annual',   value: '$22,080', tone: 'text-white' },
  { label: 'Tracked',  value: '7',       tone: 'text-white' },
  { label: 'Auto-pay', value: '5',       tone: 'text-emerald-400' },
]

const previewBills = [
  { icon: <Home size={13} />,   tint: 'bg-brand-600/20 text-brand-300',   name: 'Rent',      tag: 'Housing',       auto: true,  amount: '$1,200', due: 'due day 1',  days: '9 days' },
  { icon: <Repeat size={13} />, tint: 'bg-violet-600/20 text-violet-300', name: 'Streaming', tag: 'Subscriptions', auto: true,  amount: '$17.99', due: 'due day 9',  days: '17 days' },
  { icon: <Shield size={13} />, tint: 'bg-emerald-600/20 text-emerald-300', name: 'Car insurance', tag: 'Insurance', auto: false, amount: '$118', due: 'due day 12', days: '20 days' },
]

/**
 * A miniature of the real app, drawn in the same components and colours the app
 * itself uses. The figures are made up — a public page is no place for anyone's
 * actual balances — so it carries an "Example" label.
 */
function AppPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-brand-600/10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
      <div className="relative bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex">
          {/* Mini sidebar — dropped on phones, where there is no room for it */}
          <aside className="hidden sm:flex w-[8.5rem] shrink-0 flex-col border-r border-gray-900 p-2.5">
            <div className="flex items-center gap-2 px-1.5 pb-3 mb-1 border-b border-gray-900">
              <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign size={13} className="text-white" />
              </div>
              <span className="text-[10px] font-bold leading-tight">Finance<br />Home</span>
            </div>
            <div className="space-y-0.5 flex-1">
              {previewNav.map(n => (
                <div
                  key={n.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] ${
                    n.active ? 'bg-brand-600 text-white font-medium' : 'text-gray-500'
                  }`}
                >
                  {n.icon}{n.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-1.5 pt-2 text-[9px] text-gray-600 border-t border-gray-900">
              <Cloud size={10} /> Synced to cloud
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 p-3.5 sm:p-4">
            <div className="flex items-start justify-between mb-3.5">
              <div>
                <p className="text-sm font-bold leading-tight">Bills</p>
                <p className="text-[10px] text-gray-500">Manage recurring bills</p>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-gray-600 border border-gray-800 rounded-full px-2 py-0.5 shrink-0">
                Example
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3.5">
              {previewStats.map(s => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[9px] text-gray-500 mb-0.5 truncate">{s.label}</p>
                  <p className={`text-xs font-bold tabular-nums truncate ${s.tone}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800/70">
              {previewBills.map(b => (
                <div key={b.name} className="flex items-center gap-2.5 p-2.5">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${b.tint}`}>
                    {b.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-tight">{b.name}</p>
                    <p className="text-[9px] text-gray-600 leading-tight">
                      {b.tag}{b.auto && ' · Auto-pay'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-semibold tabular-nums">{b.amount}</p>
                    <p className="text-[9px] text-gray-600">{b.due}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 shrink-0">
                    {b.days}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
              <TrendingUp size={11} className="text-emerald-400 shrink-0" />
              Savings up 4 months running
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Landing({ onGetStarted }: LandingProps) {
  const [legalOpen, setLegalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans overflow-x-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/30 shrink-0">
              <DollarSign size={19} className="text-white" />
            </div>
            <span className="font-bold text-base">Finance Home</span>
          </div>
          <button
            type="button"
            onClick={onGetStarted}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Log in
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <Section className="pt-10 pb-14 sm:pt-20 sm:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand-400 uppercase mb-4">
              Clarity, not control
            </p>
            <h1 className="text-[2.1rem] leading-[1.1] sm:text-5xl sm:leading-[1.08] font-bold tracking-tight">
              See how your money
              <span className="block text-brand-400">is actually moving.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-400 leading-relaxed max-w-lg">
              Finance Home is not here to manage your money. It is here so you can look at it
              clearly — track what you spend, watch your savings grow, and feel sure about where
              you stand and where you are headed.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onGetStarted}
                className="px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 whitespace-nowrap"
              >
                Get started — it&rsquo;s free <ArrowRight size={17} />
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="px-6 py-3.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-200 font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                I have an account
              </button>
            </div>
            <p className="mt-5 text-xs text-gray-600">
              No ads · No tracking · Your data is never sold
            </p>
          </div>

          <AppPreview />
        </div>
      </Section>

      {/* ── Three pillars ──────────────────────────────────────── */}
      <Section className="py-14 sm:py-20 border-t border-gray-900">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
          Confidence comes from seeing it
        </h2>
        <p className="mt-3 text-center text-gray-400 max-w-xl mx-auto">
          Most money stress is not knowing. These three answers remove most of it.
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 sm:gap-5">
          {pillars.map(p => (
            <div key={p.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="w-11 h-11 rounded-xl bg-brand-600/15 text-brand-400 flex items-center justify-center mb-4">
                {p.icon}
              </div>
              <h3 className="font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── What it is not ─────────────────────────────────────── */}
      <Section className="py-14 sm:py-20 border-t border-gray-900">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 sm:p-9">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Just as important: what it is <span className="text-brand-400">not</span>
          </h2>
          <p className="mt-2.5 text-sm text-gray-400 max-w-2xl">
            Plenty of finance apps want the keys to your accounts. This one does not, and that is
            the point — you type in what matters to you, and it gives you the picture back.
          </p>
          <ul className="mt-6 space-y-3">
            {notThis.map(line => (
              <li key={line} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                  <X size={12} strokeWidth={3} />
                </span>
                <span className="text-sm text-gray-300">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Features ───────────────────────────────────────────── */}
      <Section className="py-14 sm:py-20 border-t border-gray-900">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">What is inside</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(f => (
            <div key={f.name} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2 text-brand-400">
                {f.icon}
                <h3 className="font-semibold text-sm text-white">{f.name}</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Privacy ────────────────────────────────────────────── */}
      <Section className="py-14 sm:py-20 border-t border-gray-900">
        <div className="grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Your numbers stay yours</h2>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Every row is locked to your account by the database itself, not just by the app.
              There are no ads, no analytics and no third-party scripts watching what you do.
            </p>
            <button
              type="button"
              onClick={() => setLegalOpen(true)}
              className="mt-4 text-sm text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
            >
              Read the privacy notice and terms
            </button>
          </div>
          <ul className="space-y-3">
            {[
              { icon: <Lock size={15} />, text: 'Optional PIN lock scrambles the copy saved on your phone' },
              { icon: <ShieldCheck size={15} />, text: 'Nobody else using the app can reach your data' },
              { icon: <Check size={15} />, text: 'Delete your account and everything in it, any time, instantly' },
            ].map(i => (
              <li key={i.text} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
                <span className="text-emerald-400 shrink-0 mt-0.5">{i.icon}</span>
                <span className="text-sm text-gray-300">{i.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <Section className="py-16 sm:py-24 border-t border-gray-900">
        <div className="text-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto leading-tight">
            Stop wondering where it went.
          </h2>
          <p className="mt-4 text-gray-400 max-w-md mx-auto">
            Takes a few minutes to set up. Free, and yours to delete whenever you want.
          </p>
          <button
            type="button"
            onClick={onGetStarted}
            className="mt-8 px-8 py-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-2 shadow-lg shadow-brand-600/25"
          >
            Get started — it&rsquo;s free <ArrowRight size={18} />
          </button>
        </div>
      </Section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="px-4 sm:px-6 py-8 border-t border-gray-900">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <span>Finance Home · A clearer view of your money</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setLegalOpen(true)} className="hover:text-gray-400 transition-colors">
              Privacy &amp; terms
            </button>
            <button type="button" onClick={onGetStarted} className="hover:text-gray-400 transition-colors">
              Log in
            </button>
          </div>
        </div>
        <p className="max-w-5xl mx-auto mt-4 text-[11px] text-gray-700 leading-relaxed">
          Finance Home is a tracking and planning tool, not a financial adviser, bank or broker.
          Nothing here is a recommendation to buy, sell or hold anything.
        </p>
      </footer>

      <Modal open={legalOpen} onClose={() => setLegalOpen(false)} title="Privacy & terms">
        <PrivacyAndTerms />
      </Modal>
    </div>
  )
}
