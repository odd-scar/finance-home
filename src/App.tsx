import { useState, useEffect } from 'react'
import { Tab } from './types'
import { Sidebar, BottomNav } from './components/Layout/Sidebar'
import { Header } from './components/Layout/Header'
import { Dashboard } from './components/Dashboard/Dashboard'
import { Stocks } from './components/Stocks/Stocks'
import { DebtTracker } from './components/Debt/Debt'
import { Savings } from './components/Savings/Savings'
import { Goals } from './components/Goals/Goals'
import { TripPlanner } from './components/TripPlanner/TripPlanner'
import { Budget } from './components/Budget/Budget'
import { Bills } from './components/Bills/Bills'
import { Assets } from './components/Assets/Assets'
import { AuthScreen, UpdatePasswordScreen } from './components/Auth/AuthScreen'
import { Modal } from './components/ui/Modal'
import { loadFromSupabase, setSupabaseUser, signOutCleanup } from './store/store'
import { supabase } from './utils/supabase'
import type { User } from './utils/supabase'
import { DollarSign, Loader2, Plus, TrendingUp, Receipt, Target } from 'lucide-react'
import { WelcomeTour, ONBOARDING_KEY } from './components/Onboarding/WelcomeTour'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY))

  // ── Auth state ───────────────────────────────────────────────────────
  const [user, setUser]             = useState<User | null>(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [dataLoading, setDataLoading]   = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    // Single source of truth: onAuthStateChange handles ALL session events.
    // INITIAL_SESSION fires immediately on mount with the existing session (or null),
    // replacing the need for a separate getSession() call and preventing double-loads.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      // ── Password reset link clicked ──────────────────────────────────
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        setAuthLoading(false)
        return
      }

      // ── Session established (initial load or explicit sign-in) ───────
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setPasswordRecovery(false)
        if (session?.user) {
          setUser(session.user)
          setDataLoading(true)
          try {
            await loadFromSupabase(session.user.id)
          } catch {
            // Timeout or network error — proceed with local data
          }
          setDataLoading(false)
        } else {
          setUser(null)
        }
        setAuthLoading(false)
        return
      }

      // ── Sign-out ──────────────────────────────────────────────────────
      if (event === 'SIGNED_OUT') {
        signOutCleanup()
        setUser(null)
        setPasswordRecovery(false)
        setAuthLoading(false)
        return
      }

      // ── Token refresh — just keep user object fresh ───────────────────
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
    signOutCleanup()
    setUser(null)
  }

const content: Record<Tab, React.ReactNode> = {
    dashboard: <Dashboard />,
    stocks: <Stocks />,
    debt: <DebtTracker />,
    savings: <Savings />,
    goals: <Goals />,
    trips: <TripPlanner />,
    budget: <Budget />,
    bills: <Bills />,
    assets: <Assets />,
  }

  const quickAddItems = [
    { label: 'Add Stock', icon: <TrendingUp size={14} />, tab: 'stocks' as Tab },
    { label: 'Add Bill', icon: <Receipt size={14} />, tab: 'bills' as Tab },
    { label: 'Add Transaction', icon: <DollarSign size={14} />, tab: 'budget' as Tab },
    { label: 'Add Goal', icon: <Target size={14} />, tab: 'goals' as Tab },
  ]

  // ── Auth gates ──────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
        <DollarSign size={28} className="text-white" />
      </div>
      <Loader2 size={22} className="text-brand-400 animate-spin" />
    </div>
  )

  if (passwordRecovery) return (
    <UpdatePasswordScreen onDone={() => setPasswordRecovery(false)} />
  )

  if (!user) return <AuthScreen />

  if (dataLoading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
        <DollarSign size={28} className="text-white" />
      </div>
      <p className="text-sm text-gray-400">Loading your data…</p>
      <Loader2 size={20} className="text-brand-400 animate-spin" />
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header activeTab={activeTab} userEmail={user.email} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0" style={{ paddingBottom: 'calc(52px + env(safe-area-inset-bottom))' }}>
          {content[activeTab]}
        </main>
      </div>

      {/* Quick Add floating button */}
      <div className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6">
        {/* Dropdown menu */}
        {quickAddOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setQuickAddOpen(false)}
            />
            <div className="absolute bottom-14 right-0 z-40 flex flex-col gap-2 items-end">
              {quickAddItems.map(item => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab)
                    setQuickAddOpen(false)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-700 hover:border-brand-600 hover:bg-gray-800 text-white text-sm font-medium rounded-xl shadow-xl transition-all whitespace-nowrap"
                >
                  <span className="text-brand-400">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* The + button */}
        <button
          onClick={() => setQuickAddOpen(o => !o)}
          className={`w-13 h-13 rounded-full shadow-xl flex items-center justify-center text-white font-bold text-xl transition-all ${
            quickAddOpen
              ? 'bg-gray-700 rotate-45'
              : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/30'
          }`}
          style={{ width: '52px', height: '52px' }}
          title="Quick Add"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* Bottom nav for mobile */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* First-time onboarding tour */}
      {showOnboarding && (
        <WelcomeTour
          onComplete={() => {
            setShowOnboarding(false)
            setActiveTab('dashboard')
          }}
        />
      )}
    </div>
  )
}
