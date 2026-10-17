import { useState } from 'react'
import { DollarSign, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, LogOut } from 'lucide-react'
import { savePin, verifyPin, hasPinSet, removePin, markUnlocked, MAX_PIN_ATTEMPTS } from '../../utils/auth'

const MIN_PIN = 4
const MAX_PIN = 8

function PinInput({
  value, onChange, onEnter, placeholder, large = false,
}: {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder: string
  large?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={MAX_PIN}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, MAX_PIN))}
        onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}
        autoFocus
        className={`w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors pr-12 ${large ? 'text-xl tracking-[0.5em]' : 'text-lg tracking-[0.4em]'}`}
        style={{ fontSize: '16px' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

const pinProblem = (pin: string) =>
  pin.length < MIN_PIN ? `PIN must be at least ${MIN_PIN} digits.` : /^(\d)\1+$/.test(pin) ? 'Avoid repeating one digit (e.g. 1111).' : ''

// ── Lock screen (shown when a PIN is set and the app is locked) ─────────────

interface LockScreenProps {
  userEmail?: string
  onUnlock: () => void
  /** "Forgot PIN" / too many attempts — sign out and use the account password */
  onSignOut: () => void
}

export function LockScreen({ userEmail, onUnlock, onSignOut }: LockScreenProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [loading, setLoading] = useState(false)
  const attemptsLeft = MAX_PIN_ATTEMPTS - attempts

  const handleUnlock = async () => {
    if (pin.length < MIN_PIN || loading) return
    setLoading(true)
    const ok = await verifyPin(pin)
    setLoading(false)
    if (ok) { onUnlock(); return }
    const next = attempts + 1
    setAttempts(next)
    setPin('')
    if (next >= MAX_PIN_ATTEMPTS) {
      // Too many tries: drop the PIN and require the real account password
      removePin()
      onSignOut()
      return
    }
    setError(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - next} ${MAX_PIN_ATTEMPTS - next === 1 ? 'try' : 'tries'} left.`)
  }

  const forgotPin = () => {
    removePin()
    onSignOut()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
            <DollarSign size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Finance Home</h1>
          {userEmail && <p className="text-sm text-gray-400 mt-1 break-all text-center">{userEmail}</p>}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Lock size={15} className="text-brand-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">App locked</p>
              <p className="text-xs text-gray-500">Enter your PIN to continue</p>
            </div>
          </div>

          <div className="mb-4">
            <PinInput large value={pin} onChange={v => { setPin(v); setError('') }} onEnter={handleUnlock} placeholder="PIN…" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl mb-4">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleUnlock}
            disabled={loading || pin.length < MIN_PIN}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>

          <button
            type="button"
            onClick={forgotPin}
            className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <LogOut size={13} /> Forgot PIN? Sign in with your password
          </button>
        </div>

        {attempts > 0 && attemptsLeft > 0 && (
          <p className="text-center text-xs text-gray-600 mt-4">
            After {MAX_PIN_ATTEMPTS} wrong tries you'll be signed out and the PIN is removed.
          </p>
        )}
      </div>
    </div>
  )
}

// ── PIN settings (opened from the Account menu) ────────────────────────────

interface SecuritySettingsProps {
  onClose: () => void
  onLock: () => void
}

type Mode = 'menu' | 'setup-new' | 'setup-confirm' | 'change-old' | 'change-new' | 'change-confirm' | 'remove'

export function SecuritySettings({ onClose, onLock }: SecuritySettingsProps) {
  const [pinSet, setPinSet] = useState(hasPinSet)
  const [mode, setMode] = useState<Mode>('menu')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const go = (m: Mode) => { setMode(m); setError('') }
  const reset = () => { setOldPin(''); setNewPin(''); setConfirmNewPin(''); setError(''); setSuccess('') }

  const checkNew = (next: Mode) => {
    const problem = pinProblem(newPin)
    if (problem) { setError(problem); return }
    go(next)
  }

  const saveNew = async (message: string) => {
    if (newPin !== confirmNewPin) { setError("PINs don't match."); setConfirmNewPin(''); return }
    setLoading(true)
    await savePin(newPin)
    markUnlocked() // you just proved it's you — don't lock on the next reload
    setLoading(false)
    setPinSet(true)
    reset()
    setSuccess(message)
    setMode('menu')
  }

  const verifyOld = async (next: () => void) => {
    setLoading(true)
    const ok = await verifyPin(oldPin)
    setLoading(false)
    if (!ok) { setError('Incorrect PIN.'); setOldPin(''); return }
    setError('')
    next()
  }

  const actions = (back: () => void, primary: { label: string; onClick: () => void; danger?: boolean }) => (
    <div className="flex gap-2">
      <button type="button" onClick={back} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
      <button
        type="button"
        onClick={primary.onClick}
        disabled={loading}
        className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 ${primary.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-brand-600 hover:bg-brand-500'}`}
      >
        {loading ? 'Working…' : primary.label}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-2 p-3 rounded-xl border ${pinSet ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-800/60 border-gray-700'}`}>
        <ShieldCheck size={15} className={`shrink-0 mt-0.5 ${pinSet ? 'text-emerald-400' : 'text-gray-400'}`} />
        <p className={`text-xs ${pinSet ? 'text-emerald-400' : 'text-gray-400'}`}>
          {pinSet
            ? 'PIN lock is on for this device. The app locks after 5 minutes in the background, and whenever you tap "Lock now".'
            : 'Add a PIN to lock the app on this device, like a banking app. Your account password still protects your data everywhere.'}
        </p>
      </div>

      {success && (
        <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
          <p className="text-xs text-brand-400">{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <AlertTriangle size={13} className="text-rose-400 shrink-0" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {mode === 'menu' && (
        <div className="space-y-2">
          {!pinSet && (
            <button
              type="button"
              onClick={() => { reset(); go('setup-new') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-brand-600/20 hover:bg-brand-600/30 border border-brand-600/30 rounded-xl text-left transition-colors"
            >
              <ShieldCheck size={16} className="text-brand-400" />
              <div>
                <p className="text-sm font-medium text-white">Set up PIN lock</p>
                <p className="text-xs text-gray-400">{MIN_PIN}–{MAX_PIN} digits</p>
              </div>
            </button>
          )}
          {pinSet && (
            <>
              <button
                type="button"
                onClick={onLock}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
              >
                <Lock size={16} className="text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-white">Lock now</p>
                  <p className="text-xs text-gray-500">Requires your PIN to reopen</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { reset(); go('change-old') }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
              >
                <ShieldCheck size={16} className="text-amber-400" />
                <p className="text-sm font-medium text-white">Change PIN</p>
              </button>
              <button
                type="button"
                onClick={() => { reset(); go('remove') }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-rose-500/10 rounded-xl text-left transition-colors"
              >
                <AlertTriangle size={16} className="text-rose-400" />
                <p className="text-sm font-medium text-white">Turn off PIN lock</p>
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Close
          </button>
        </div>
      )}

      {mode === 'setup-new' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Choose a PIN:</p>
          <PinInput value={newPin} onChange={v => { setNewPin(v); setError('') }} onEnter={() => checkNew('setup-confirm')} placeholder="New PIN…" />
          {actions(() => go('menu'), { label: 'Continue', onClick: () => checkNew('setup-confirm') })}
        </div>
      )}

      {mode === 'setup-confirm' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Confirm your PIN:</p>
          <PinInput value={confirmNewPin} onChange={v => { setConfirmNewPin(v); setError('') }} onEnter={() => saveNew('PIN lock is on.')} placeholder="Confirm PIN…" />
          {actions(() => { setConfirmNewPin(''); go('setup-new') }, { label: 'Turn on', onClick: () => saveNew('PIN lock is on.') })}
          <p className="text-xs text-gray-500">Forgot it later? Just sign in again with your account password.</p>
        </div>
      )}

      {mode === 'change-old' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Enter your current PIN:</p>
          <PinInput value={oldPin} onChange={v => { setOldPin(v); setError('') }} onEnter={() => verifyOld(() => go('change-new'))} placeholder="Current PIN…" />
          {actions(() => go('menu'), { label: 'Continue', onClick: () => verifyOld(() => go('change-new')) })}
        </div>
      )}

      {mode === 'change-new' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Enter your new PIN:</p>
          <PinInput value={newPin} onChange={v => { setNewPin(v); setError('') }} onEnter={() => checkNew('change-confirm')} placeholder="New PIN…" />
          {actions(() => go('change-old'), { label: 'Continue', onClick: () => checkNew('change-confirm') })}
        </div>
      )}

      {mode === 'change-confirm' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Confirm your new PIN:</p>
          <PinInput value={confirmNewPin} onChange={v => { setConfirmNewPin(v); setError('') }} onEnter={() => saveNew('PIN updated.')} placeholder="Confirm PIN…" />
          {actions(() => { setConfirmNewPin(''); go('change-new') }, { label: 'Save PIN', onClick: () => saveNew('PIN updated.') })}
        </div>
      )}

      {mode === 'remove' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Enter your PIN to turn off the lock:</p>
          <PinInput value={oldPin} onChange={v => { setOldPin(v); setError('') }} onEnter={() => verifyOld(() => { removePin(); setPinSet(false); reset(); setSuccess('PIN lock is off.'); setMode('menu') })} placeholder="Current PIN…" />
          {actions(() => go('menu'), {
            label: 'Turn off',
            danger: true,
            onClick: () => verifyOld(() => { removePin(); setPinSet(false); reset(); setSuccess('PIN lock is off.'); setMode('menu') }),
          })}
        </div>
      )}
    </div>
  )
}
