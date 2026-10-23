/**
 * Shown when another device saved after this one last synced.
 *
 * Saving is paused while this is up, because either answer loses something: taking
 * the other device's copy drops the edits made here, and keeping this device's copy
 * overwrites what the other one saved. That choice belongs to the person, not to
 * whichever device happened to hit the network last.
 */
import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useAppStore } from '../../hooks/useAppStore'

export function SyncConflictBanner() {
  const { getSyncConflict, useCloudVersion, keepThisDevice } = useAppStore()
  const [busy, setBusy] = useState<'cloud' | 'local' | null>(null)

  if (!getSyncConflict()) return null

  const choose = async (side: 'cloud' | 'local') => {
    setBusy(side)
    try {
      if (side === 'cloud') await useCloudVersion()
      else await keepThisDevice()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[320] bg-amber-600 text-white shadow-lg"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 pb-2.5">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p className="text-sm">
            <span className="font-semibold">You changed this on another device.</span>{' '}
            Saving is paused so nothing gets erased — which copy do you want to keep?
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void choose('cloud')}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            {busy === 'cloud' && <Loader2 size={12} className="animate-spin" />}
            Use the other device
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void choose('local')}
            className="px-3 py-1.5 bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            {busy === 'local' && <Loader2 size={12} className="animate-spin" />}
            Keep this one
          </button>
        </div>
      </div>
    </div>
  )
}
