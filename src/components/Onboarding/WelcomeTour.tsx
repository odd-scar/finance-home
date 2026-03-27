import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  DollarSign,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Target,
  Plane,
  CheckCircle,
  X,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'

export const ONBOARDING_KEY = 'financeHome_onboarded'

type Phase = 'welcome' | 'tour' | 'done'

interface TourStep {
  tab: string
  title: string
  description: string
  icon: React.ReactNode
  colorClass: string
  bgClass: string
}

const tourSteps: TourStep[] = [
  {
    tab: 'dashboard',
    title: 'Dashboard',
    description: 'Your financial snapshot at a glance — see net worth, recent activity, and key metrics all in one place.',
    icon: <LayoutDashboard size={24} />,
    colorClass: 'text-brand-400',
    bgClass: 'bg-brand-500/15',
  },
  {
    tab: 'budget',
    title: 'Budget',
    description: 'Track income and expenses by category. Set limits, see where your money goes, and stay on track.',
    icon: <BarChart3 size={24} />,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/15',
  },
  {
    tab: 'stocks',
    title: 'Stocks',
    description: 'Monitor your portfolio and get trend insights. Watch your investments grow over time.',
    icon: <TrendingUp size={24} />,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/15',
  },
  {
    tab: 'debt',
    title: 'Debt',
    description: 'Manage and plan your debt payoff. Use avalanche or snowball strategies to become debt-free faster.',
    icon: <CreditCard size={24} />,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/15',
  },
  {
    tab: 'savings',
    title: 'Savings',
    description: 'Set savings goals and watch them grow. Track multiple savings accounts and milestones.',
    icon: <PiggyBank size={24} />,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/15',
  },
  {
    tab: 'goals',
    title: 'Goals',
    description: 'Create financial goals with deadlines. Stay motivated as you make progress toward what matters most.',
    icon: <Target size={24} />,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/15',
  },
  {
    tab: 'trips',
    title: 'Trip Planner',
    description: 'Budget your next adventure. Plan trips, track expenses, and travel without financial surprises.',
    icon: <Plane size={24} />,
    colorClass: 'text-sky-400',
    bgClass: 'bg-sky-500/15',
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface WelcomeTourProps {
  onComplete: () => void
}

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [tourIndex, setTourIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [visible, setVisible] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  // Fade in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Focus the card on mount and phase/step changes
  useEffect(() => {
    if (visible && cardRef.current) {
      const firstFocusable = cardRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [visible, phase, tourIndex])

  // Compute spotlight position for current tour step
  const updateSpotlight = useCallback(() => {
    if (phase !== 'tour') {
      setSpotlightRect(null)
      return
    }
    const step = tourSteps[tourIndex]
    const el = document.querySelector(`[data-tour-id="${step.tab}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      setSpotlightRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    } else {
      setSpotlightRect(null)
    }
  }, [phase, tourIndex])

  useEffect(() => {
    updateSpotlight()
    window.addEventListener('resize', updateSpotlight)
    return () => window.removeEventListener('resize', updateSpotlight)
  }, [updateSpotlight])

  // ESC to skip + focus trap
  const handleComplete = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      localStorage.setItem(ONBOARDING_KEY, 'true')
      onComplete()
    }, 280)
  }, [onComplete])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleComplete()
        return
      }
      if (e.key === 'Tab' && cardRef.current) {
        const focusable = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
          )
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleComplete])

  const goToStep = (index: number) => {
    setTourIndex(index)
    setContentKey(k => k + 1)
  }

  const handleNext = () => {
    if (tourIndex < tourSteps.length - 1) {
      goToStep(tourIndex + 1)
    } else {
      setPhase('done')
      setContentKey(k => k + 1)
    }
  }

  const handleBack = () => {
    if (tourIndex > 0) {
      goToStep(tourIndex - 1)
    } else {
      setPhase('welcome')
      setContentKey(k => k + 1)
    }
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024
  const currentStep = tourSteps[tourIndex]
  const PAD = 8

  const cardStyle: React.CSSProperties = (() => {
    if (phase !== 'tour') {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 420px)',
        zIndex: 10001,
      }
    }
    if (isDesktop) {
      return {
        position: 'fixed',
        left: '256px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 'min(360px, calc(100vw - 290px))',
        zIndex: 10001,
      }
    }
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(92vw, 380px)',
      zIndex: 10001,
    }
  })()

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finance Home — Getting Started"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.28s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* ── Overlay / Spotlight ─────────────────────────────────────── */}
      {spotlightRect ? (
        // Transparent box whose massive box-shadow dims everything outside it
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: spotlightRect.top - PAD,
            left: spotlightRect.left - PAD,
            width: spotlightRect.width + PAD * 2,
            height: spotlightRect.height + PAD * 2,
            borderRadius: '14px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.84)',
            border: '2px solid rgba(99,102,241,0.65)',
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.84)',
            backdropFilter: 'blur(2px)',
            zIndex: 10000,
          }}
        />
      )}

      {/* ── Card ────────────────────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* ── Welcome ─────────────────────────────────────────────── */}
        {phase === 'welcome' && (
          <div key={contentKey} className="animate-scale-in flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
              <DollarSign size={30} className="text-white" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-white mb-2 leading-tight">
                Welcome to Finance Home
              </h1>
              <p className="text-brand-400 text-sm font-medium">
                Your personal financial command center
              </p>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Take a quick tour to discover everything this app can do for you, or jump straight in if you prefer.
            </p>
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => { setPhase('tour'); setContentKey(k => k + 1) }}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                Start Tour <ArrowRight size={15} />
              </button>
              <button
                onClick={handleComplete}
                className="w-full py-2.5 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
              >
                Skip Tour
              </button>
            </div>
          </div>
        )}

        {/* ── Tour step ───────────────────────────────────────────── */}
        {phase === 'tour' && (
          <div key={contentKey} className="animate-fade-in flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${currentStep.bgClass} ${currentStep.colorClass}`}>
                {currentStep.icon}
              </div>
              <button
                onClick={handleComplete}
                aria-label="Skip tour"
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                {tourIndex + 1} of {tourSteps.length}
              </p>
              <h2 className="text-xl font-bold text-white mb-2">{currentStep.title}</h2>
              <p className="text-gray-300 text-sm leading-relaxed">{currentStep.description}</p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Tour steps">
              {tourSteps.map((step, i) => (
                <button
                  key={step.tab}
                  role="tab"
                  aria-selected={i === tourIndex}
                  aria-label={`Go to ${step.title}`}
                  onClick={() => goToStep(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === tourIndex
                      ? 'w-6 h-2 bg-brand-500'
                      : i < tourIndex
                      ? 'w-2 h-2 bg-brand-800'
                      : 'w-2 h-2 bg-gray-700 hover:bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2.5">
              <button
                onClick={handleBack}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {tourIndex === tourSteps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14} />
              </button>
            </div>

            <button
              onClick={handleComplete}
              className="text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Skip Tour
            </button>
          </div>
        )}

        {/* ── Done ────────────────────────────────────────────────── */}
        {phase === 'done' && (
          <div key={contentKey} className="animate-scale-in flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-white mb-2">You're all set!</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Start by adding your accounts, stocks, or budget to get a real picture of your finances.
              </p>
            </div>

            {/* Section summary */}
            <ul className="w-full space-y-1.5 text-left">
              {tourSteps.map(s => (
                <li key={s.tab} className="flex items-center gap-2 text-sm">
                  <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  <span className={`${s.colorClass} font-medium`}>{s.title}</span>
                  <span className="text-gray-600 text-xs">— ready to use</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleComplete}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              Go to Dashboard <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
