import { useState } from 'react'
import { Tab } from '../../types'
import { LogOut, Lock, RefreshCw, Loader2 } from 'lucide-react'
import { clearAppCache } from '../../services/appCache'
import { Modal } from '../ui/Modal'
import { SecuritySettings } from '../Lock/LockScreen'

const titles: Record<Tab, string> = {
  dashboard: 'Dashboard',
  stocks: 'Stock Portfolio',
  debt: 'Debt Tracker',
  savings: 'Savings',
  goals: 'Financial Goals',
  trips: 'Trip Planner',
  budget: 'Budget',
  bills: 'Bills',
  assets: 'Assets',
  learn: 'Investor Guide',
}

const subtitles: Record<Tab, string> = {
  dashboard: 'Your financial overview',
  stocks: 'Track your investments',
  debt: 'Manage and pay off debt',
  savings: 'Grow your savings',
  goals: 'Track your milestones',
  trips: 'Plan and budget trips',
  budget: 'Monitor income & expenses',
  bills: 'Manage recurring bills',
  assets: 'Track physical assets',
  learn: 'Build wealth with confidence',
}

interface HeaderProps {
  activeTab: Tab
  userEmail?: string
  onSignOut?: () => void
  onLock?: () => void
}

/** Returns up to 2 uppercase initials from an email address */
function getInitials(email: string): string {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function Header({ activeTab, userEmail, onSignOut, onLock }: HeaderProps) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [cacheStep, setCacheStep] = useState<'idle' | 'confirm' | 'working' | 'offline'>('idle')

  const handleClearCache = async () => {
    setCacheStep('working')
    const { dataCleared } = await clearAppCache()
    if (!dataCleared) {
      setCacheStep('offline')
      await new Promise(r => setTimeout(r, 2500))
    }
    window.location.reload()
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white">{titles[activeTab]}</h1>
          <p className="hidden sm:block text-sm text-gray-400">{subtitles[activeTab]}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Account avatar — shows user's initials */}
          {userEmail && (
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center transition-colors font-bold text-xs tracking-wide shadow-md shadow-brand-600/30 touch-manipulation"
              title={userEmail}
            >
              {getInitials(userEmail)}
            </button>
          )}
        </div>
      </header>

      {/* Account modal */}
      <Modal open={accountOpen} onClose={() => { setAccountOpen(false); if (cacheStep === 'confirm') setCacheStep('idle') }} title="Account">
        <div className="space-y-4">
          {/* Avatar + email */}
          <div className="flex items-center gap-4 p-4 bg-gray-800/60 border border-gray-700 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-brand-600/30 shrink-0">
              {getInitials(userEmail!)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Signed in</p>
              <p className="text-xs text-gray-400 break-all">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-xs text-emerald-400">
              Data syncs automatically. Sign in on any device to access your finances.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { setAccountOpen(false); setSecurityOpen(true) }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-sm font-medium transition-colors"
          >
            <Lock size={15} /> PIN Lock
          </button>

          {/* Clear cache — with a confirm step so it's never hit by accident */}
          {cacheStep === 'idle' ? (
            <button
              type="button"
              onClick={() => setCacheStep('confirm')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw size={15} /> Clear cache & reload
            </button>
          ) : (
            <div className="p-3 bg-gray-800/60 border border-gray-700 rounded-xl space-y-3">
              <p className="text-xs text-gray-300">
                {cacheStep === 'offline'
                  ? "Couldn't reach the cloud, so your data on this device was kept. App files were refreshed — reloading…"
                  : 'Saves your changes to the cloud, clears the app files and cached data on this device, then reloads with a fresh copy. You stay signed in.'}
              </p>
              {cacheStep === 'confirm' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCacheStep('idle')}
                    className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="flex-1 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
                  >
                    Clear & reload
                  </button>
                </div>
              )}
              {cacheStep === 'working' && (
                <p className="flex items-center gap-2 text-xs text-brand-400"><Loader2 size={13} className="animate-spin" /> Saving and clearing…</p>
              )}
            </div>
          )}

          <button
            onClick={() => { setAccountOpen(false); onSignOut?.() }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium transition-colors"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </Modal>

      <Modal open={securityOpen} onClose={() => setSecurityOpen(false)} title="PIN Lock">
        <SecuritySettings
          onClose={() => setSecurityOpen(false)}
          onLock={() => { setSecurityOpen(false); onLock?.() }}
        />
      </Modal>
    </>
  )
}
