import { useState, useEffect, useCallback, useRef } from 'react'
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
import { LockScreen, SecuritySettings } from './components/Lock/LockScreen'
import { AuthScreen, UpdatePasswordScreen } from './components/Auth/AuthScreen'
import { Modal } from './components/ui/Modal'
import { hasPinSet, isSessionActive, clearSession, getSessionPin } from './utils/auth'
import { reinitializeStore, loadFromSupabase, setSupabaseUser, signOutCleanup } from './store/store'
import { supabase } from './utils/supabase'
import type { User } from './utils/supabase'
import { DollarSign, Loader2, Plus, TrendingUp, Receipt, Target } from 'lucide-react'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [quickAddOpen, setQuickAddOpen] = useState(false)

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

  // ── Lock state ──────────────────────────────────────────────────────
  const [locked, setLocked] = useState(() => {
    if (!hasPinSet()) return false
    if (isSessionActive()) {
      const pin = getSessionPin()
      if (pin) reinitializeStore(pin)
      return false
    }
    return true
  })

  // ── First-visit PIN setup prompt ─────────────────────────────────────
  const [showPinSetup, setShowPinSetup] = useState(() => !hasPinSet())
  const handlePinSetupClose = () => setShowPinSetup(false)

  // ── Idle timer (auto-lock after 15 min of no activity) ─────────────
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetIdleTimer = useCallback(() => {
    if (!hasPinSet()) return
    if (idleRef.current) clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => {
      clearSession()
      setLocked(true)
    }, IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach(e => document.removeEventListener(e, resetIdleTimer))
      if (idleRef.current) clearTimeout(idleRef.current)
    }
  }, [resetIdleTimer])

  const handleUnlock = () => { setLocked(false); resetIdleTimer() }
  const handleLock   = () => { clearSession(); setLocked(true) }

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

  if (locked) return <LockScreen onUnlock={handleUnlock} />

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header activeTab={activeTab} onLock={handleLock} userEmail={user.email} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {content[activeTab]}
        </main>
      </div>

      {/* First-visit PIN setup — auto-opens when no PIN is configured */}
      <Modal
        open={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        title="Secure Your Data"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-sm text-amber-300 font-medium mb-1">⚠️ No PIN set — your data is unencrypted</p>
            <p className="text-xs text-gray-400">
              Set up a PIN to encrypt all your financial data with AES-256.
              Without it, anyone who opens this URL can see your data.
            </p>
          </div>
          <SecuritySettings
            onClose={handlePinSetupClose}
            onLock={() => { handlePinSetupClose(); handleLock() }}
          />
        </div>
      </Modal>

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
    </div>
  )
}
