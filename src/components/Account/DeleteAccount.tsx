/**
 * "Delete my account" — permanent, so it asks twice: a confirm step that spells out
 * what goes, and the word DELETE typed by hand.
 *
 * The erase itself runs in Postgres (`delete_my_account`), which works out who is
 * asking from the signed-in session rather than from anything the browser sends.
 * Removing the login cascades to the saved data, so one call clears everything.
 */
import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

const CONFIRM_WORD = 'DELETE'

interface DeleteAccountProps {
  /** Runs after the account is gone — reuse the normal sign-out cleanup */
  onDeleted: () => void
}

export function DeleteAccount({ onDeleted }: DeleteAccountProps) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'working'>('idle')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setStep('working')
    setError('')
    const { error: err } = await supabase.rpc('delete_my_account')
    if (err) {
      setError("Couldn't delete the account just now. Check your connection and try again.")
      setStep('confirm')
      return
    }
    // The session belongs to an account that no longer exists; clear this device.
    onDeleted()
  }

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={() => { setStep('confirm'); setTyped(''); setError('') }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-rose-500/15 border border-gray-700 hover:border-rose-500/30 text-gray-400 hover:text-rose-400 rounded-xl text-sm font-medium transition-colors"
      >
        <Trash2 size={15} /> Delete my account
      </button>
    )
  }

  return (
    <div className="p-3 bg-rose-500/8 border border-rose-500/20 rounded-xl space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-300">
          This erases your login and <strong className="text-gray-100">everything in it</strong> — budget,
          bills, savings, goals, debts, assets, stocks and trips — on every device. It cannot be undone and
          there is no backup. Save anything you want to keep first.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] text-gray-400">
          Type <strong className="text-gray-200">{CONFIRM_WORD}</strong> to confirm
        </span>
        <input
          type="text"
          value={typed}
          autoComplete="off"
          disabled={step === 'working'}
          onChange={e => { setTyped(e.target.value); setError('') }}
          className="w-full bg-gray-800 border border-gray-700 focus:border-rose-500 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none transition-colors text-base"
          placeholder={CONFIRM_WORD}
        />
      </label>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {step === 'working' ? (
        <p className="flex items-center gap-2 text-xs text-rose-400">
          <Loader2 size={13} className="animate-spin" /> Deleting your account…
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setStep('idle'); setTyped(''); setError('') }}
            className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
            className="flex-1 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-lg transition-colors"
          >
            Delete forever
          </button>
        </div>
      )}
    </div>
  )
}
