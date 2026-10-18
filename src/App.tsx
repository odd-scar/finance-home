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
import { Learn } from './components/Learn/Learn'
import { AuthScreen, UpdatePasswordScreen } from './components/Auth/AuthScreen'
import { Modal } from './components/ui/Modal'
import { loadFromSupabase, setSupabaseUser, signOutCleanup, rolloverRecurringEntries } from './store/store'
import { supabase } from './utils/supabase'
import type { User } from './utils/supabase'
import { DollarSign, Loader2, Plus, TrendingUp, Receipt, Target, Wallet } from 'lucide-react'
import { reloadToLatest } from './utils/appCache'
import { WelcomeTour, ONBOARDING_KEY } from './components/Onboarding/WelcomeTour'
import { LockScreen } from './components/Lock/LockScreen'
import { hasPinSet, isUnlocked, markUnlocked, clearUnlocked, removePin, AUTO_LOCK_MS } from './utils/auth'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDING_KEY))

  // ── Auth state ───────────────────────────────────────────────────────
  const [user, setUser]             = useState<User | null>(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [dataLoading, setDataLoading]   = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // Optional PIN quick-lock on top of the account login
  const [locked, setLocked] = useState(() => hasPinSet() && !isUnlocked())

  const lockApp = () => {
    if (!hasPinSet()) return
    clearUnlocked()
    setLocked(true)
  }

  // New deploy downloaded by the service worker → offer a reload (never forced mid-entry)
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    const hadController = !!sw.controller // false on first install — that's not an "update"
    const onControllerChange = () => { if (hadController) setUpdateReady(true) }
    // Installed phone apps can stay open for days; look for a new version when reopened
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') sw.getRegistration().then(r => r?.update()).catch(() => {})
    }
    sw.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', checkForUpdate)
    return () => {
      sw.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', checkForUpdate)
    }
  }, [])

  // Auto-lock after the app has been in the background for a while
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt >= AUTO_LOCK_MS) lockApp()
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

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
        // Typing the account password is a stronger check than the PIN — no need to ask again
        if (event === 'SIGNED_IN' && session?.user) {
          markUnlocked()
          setLocked(false)
        }
        if (session?.user) {
          setUser(session.user)
          setDataLoading(true)
          try {
            await loadFromSupabase(session.user.id)
          } catch {
            // Timeout or network error — proceed with local data
          }
          // Carry recurring income/expenses into the current month right away, so the
          // Dashboard is right even if Budget hasn't been opened yet
          const now = new Date()
          rolloverRecurringEntries(now.getMonth() + 1, now.getFullYear())
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
        removePin()
        clearUnlocked()
        setLocked(false)
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
    // The PIN belongs to this device + account; the next person signing in sets their own
    removePin()
    clearUnlocked()
    setLocked(false)
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
    learn: <Learn />,
  }

  const quickAddItems = [
    { label: 'Log Expense', icon: <Wallet size={16} />, tab: 'budget' as Tab },
    { label: 'Add Bill', icon: <Receipt size={16} />, tab: 'bills' as Tab },
    { label: 'Add Stock', icon: <TrendingUp size={16} />, tab: 'stocks' as Tab },
    { label: 'Add Goal', icon: <Target size={16} />, tab: 'goals' as Tab },
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

  if (locked) return (
    <LockScreen
      userEmail={user.email}
      onUnlock={() => { markUnlocked(); setLocked(false) }}
      onSignOut={handleSignOut}
    />
  )

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans">
      {updateReady && (
        <div
          className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-3 px-4 py-2.5 bg-brand-600 text-white text-sm shadow-lg"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
        >
          <span>A new version of Finance Home is ready.</span>
          <button
            type="button"
            onClick={() => { void reloadToLatest() }}
            className="px-3 py-1 bg-white text-brand-700 font-semibold rounded-lg text-xs hover:bg-brand-50"
          >
            Reload
          </button>
          <button type="button" onClick={() => setUpdateReady(false)} className="text-white/70 hover:text-white text-xs">
            Later
          </button>
        </div>
      )}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header activeTab={activeTab} userEmail={user.email} onSignOut={handleSignOut} onLock={lockApp} />
        {/* Bottom padding clears the phone's bottom bar (incl. the raised + button) */}
        <main className="flex-1 overflow-y-auto pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
          {content[activeTab]}
        </main>
      </div>

      {/* Quick add — phone: bottom sheet opened from the + in the bottom bar */}
      {quickAddOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setQuickAddOpen(false)} />
          <div
            className="fixed left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl animate-slide-up p-4"
            style={{ bottom: 'calc(52px + env(safe-area-inset-bottom))' }}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1 mb-2">Add</p>
            <div className="grid grid-cols-2 gap-2">
              {quickAddItems.map(item => (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => { setActiveTab(item.tab); setQuickAddOpen(false) }}
                  className="flex items-center gap-3 px-4 py-4 bg-gray-800 hover:bg-gray-700 active:scale-[0.98] rounded-xl text-left transition-all"
                >
                  <span className="p-2 rounded-lg bg-brand-600/20 text-brand-400">{item.icon}</span>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add floating button — desktop only (phones use the + in the bottom bar) */}
      <div className="hidden lg:block fixed bottom-6 right-6 z-40">
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
      <BottomNav
        activeTab={activeTab}
        onTabChange={tab => { setQuickAddOpen(false); setActiveTab(tab) }}
        onQuickAdd={() => setQuickAddOpen(o => !o)}
        quickAddOpen={quickAddOpen}
      />

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
