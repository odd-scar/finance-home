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

          {/* Illustrative month view — shows the idea, not real numbers */}
          <div className="relative">
            <div className="absolute -inset-6 bg-brand-600/10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-gray-300">This month</p>
                <span className="text-[10px] uppercase tracking-wider text-gray-600 border border-gray-800 rounded-full px-2 py-0.5">
                  Example
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {[
                  { label: 'Came in', value: '$4,200', tone: 'text-white' },
                  { label: 'Spoken for', value: '$2,850', tone: 'text-white' },
                  { label: 'Left', value: '$1,350', tone: 'text-emerald-400' },
                ].map(c => (
                  <div key={c.label} className="bg-gray-800/60 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-sm sm:text-base font-bold tabular-nums ${c.tone}`}>{c.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Rent & bills', pct: 62, color: 'bg-brand-500' },
                  { name: 'Food & going out', pct: 38, color: 'bg-emerald-500' },
                  { name: 'Into savings', pct: 24, color: 'bg-amber-500' },
                ].map(r => (
                  <div key={r.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">{r.name}</span>
                      <span className="text-gray-500 tabular-nums">{r.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-500">
                <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                Savings up 4 months running
              </div>
            </div>
          </div>
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
