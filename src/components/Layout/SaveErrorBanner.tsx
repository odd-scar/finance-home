/**
 * Shown when this device can no longer save — otherwise the failure is silent:
 * the change looks fine on screen and is gone after a reload.
 *
 * It re-renders through useAppStore, which is notified on every commit, so the
 * banner appears on the save that failed and disappears on the next one that works.
 */
import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../hooks/useAppStore'

export function SaveErrorBanner() {
  const { getSaveError } = useAppStore()
  const message = getSaveError()
  if (!message) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[310] flex items-start justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm shadow-lg"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <span className="max-w-xl">{message}</span>
    </div>
  )
}
