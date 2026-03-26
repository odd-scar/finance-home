import { useState } from 'react'
import { DollarSign, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react'
import { savePin, verifyPin, hasPinSet, setSessionPin, removePin } from '../../utils/auth'
import { reinitializeStore } from '../../store/store'

interface LockScreenProps {
  onUnlock: () => void
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const isSetup = !hasPinSet()
  const [step, setStep] = useState<'enter' | 'create' | 'confirm'>(isSetup ? 'create' : 'enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEnter = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setLoading(true)
    const ok = await verifyPin(pin)
    setLoading(false)
    if (ok) {
      setSessionPin(pin)
      reinitializeStore(pin)
      onUnlock()
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  const handleCreate = () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    if (!/^\d+$/.test(pin)) { setError('PIN must be numbers only.'); return }
    setError('')
    setStep('confirm')
  }

  const handleConfirm = async () => {
    if (pin !== confirmPin) {
      setError("PINs don't match. Try again.")
      setConfirmPin('')
      return
    }
    setLoading(true)
    await savePin(pin)
    setSessionPin(pin)
    reinitializeStore(pin)
    setLoading(false)
    onUnlock()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'enter') handleEnter()
      else if (step === 'create') handleCreate()
      else if (step === 'confirm') handleConfirm()
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
            <DollarSign size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Finance Home</h1>
          <p className="text-sm text-gray-400 mt-1">Your personal finance dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Lock size={15} className="text-brand-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">
                {step === 'enter' ? 'Enter your PIN' : step === 'create' ? 'Create a PIN' : 'Confirm your PIN'}
              </p>
              <p className="text-xs text-gray-500">
                {step === 'enter' ? 'Your data is encrypted' : step === 'create' ? 'Minimum 4 digits' : 'Enter your PIN again'}
              </p>
            </div>
          </div>

          {/* PIN input */}
          <div className="relative mb-4">
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={step === 'confirm' ? 'Confirm PIN…' : 'Enter PIN…'}
              value={step === 'confirm' ? confirmPin : pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '')
                if (step === 'confirm') setConfirmPin(val)
                else setPin(val)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl px-4 py-3 text-white text-xl tracking-[0.5em] placeholder-gray-600 focus:outline-none transition-colors pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl mb-4">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <p className="text-xs text-rose-400">{error}</p>
            </div>
          )}

          <button
            onClick={step === 'enter' ? handleEnter : step === 'create' ? handleCreate : handleConfirm}
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Verifying…' : step === 'enter' ? 'Unlock' : step === 'create' ? 'Continue' : 'Create PIN & Unlock'}
          </button>

          {/* Back link on confirm step */}
          {step === 'confirm' && (
            <button
              onClick={() => { setStep('create'); setConfirmPin(''); setError('') }}
              className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Security note */}
        {step !== 'enter' && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-brand-500/5 border border-brand-500/15 rounded-xl">
            <ShieldCheck size={15} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Your PIN encrypts all data stored on this device using AES-256.
              The PIN is never sent anywhere — only you can access your data.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-700 mt-4">
          All data stays on your device · No account required
        </p>
      </div>
    </div>
  )
}

// ── Security Settings Modal (used from Header) ─────────────────────────────
interface SecuritySettingsProps {
  onClose: () => void
  onLock: () => void
}

export function SecuritySettings({ onClose, onLock }: SecuritySettingsProps) {
  const pinSet = hasPinSet()
  const [mode, setMode] = useState<'menu' | 'setup-new' | 'setup-confirm' | 'change-old' | 'change-new' | 'change-confirm' | 'remove'>('menu')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleChangeVerifyOld = async () => {
    setLoading(true)
    const ok = await verifyPin(oldPin)
    setLoading(false)
    if (!ok) { setError('Incorrect current PIN.'); return }
    setError('')
    setMode('change-new')
  }

  const handleChangeNew = () => {
    if (newPin.length < 4) { setError('New PIN must be at least 4 digits.'); return }
    if (!/^\d+$/.test(newPin)) { setError('PIN must be numbers only.'); return }
    setError('')
    setMode('change-confirm')
  }

  const handleChangeConfirm = async () => {
    if (newPin !== confirmNewPin) { setError("PINs don't match."); setConfirmNewPin(''); return }
    setLoading(true)
    await savePin(newPin)
    setSessionPin(newPin)
    reinitializeStore(newPin)
    setLoading(false)
    setSuccess('PIN updated! Your data is now encrypted with the new PIN.')
    setMode('menu')
  }

  const handleRemovePin = async () => {
    setLoading(true)
    const ok = await verifyPin(oldPin)
    setLoading(false)
    if (!ok) { setError('Incorrect PIN.'); return }
    removePin()
    reinitializeStore(null)
    setSuccess('PIN removed. Data is no longer encrypted.')
    setMode('menu')
  }

  const pinInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="relative">
      <input
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value.replace(/\D/g, '')); setError('') }}
        autoFocus
        className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl px-4 py-3 text-white text-lg tracking-[0.4em] placeholder-gray-600 focus:outline-none transition-colors pr-12"
      />
      <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
        <p className="text-xs text-emerald-400">
          {pinSet ? 'PIN active — data is AES-encrypted in your browser' : 'No PIN set — data is stored in plaintext'}
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
          {/* No PIN set — show setup option prominently */}
          {!pinSet && (
            <button
              onClick={() => { setMode('setup-new'); setNewPin(''); setConfirmNewPin(''); setError('') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-brand-600/20 hover:bg-brand-600/30 border border-brand-600/30 rounded-xl text-left transition-colors"
            >
              <ShieldCheck size={16} className="text-brand-400" />
              <div>
                <p className="text-sm font-medium text-white">Set Up PIN</p>
                <p className="text-xs text-gray-400">Encrypt your data with a PIN</p>
              </div>
            </button>
          )}
          {pinSet && (
            <button
              onClick={onLock}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
            >
              <Lock size={16} className="text-brand-400" />
              <div>
                <p className="text-sm font-medium text-white">Lock App Now</p>
                <p className="text-xs text-gray-500">Requires PIN to reopen</p>
              </div>
            </button>
          )}
          {pinSet && (
            <button
              onClick={() => { setMode('change-old'); setOldPin(''); setNewPin(''); setConfirmNewPin(''); setError('') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-left transition-colors"
            >
              <ShieldCheck size={16} className="text-amber-400" />
              <div>
                <p className="text-sm font-medium text-white">Change PIN</p>
                <p className="text-xs text-gray-500">Update your encryption PIN</p>
              </div>
            </button>
          )}
          {pinSet && (
            <button
              onClick={() => { setMode('remove'); setOldPin(''); setError('') }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-rose-500/10 rounded-xl text-left transition-colors"
            >
              <AlertTriangle size={16} className="text-rose-400" />
              <div>
                <p className="text-sm font-medium text-white">Remove PIN</p>
                <p className="text-xs text-gray-500">Data will be stored unencrypted</p>
              </div>
            </button>
          )}
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Close
          </button>
        </div>
      )}

      {mode === 'setup-new' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Choose a PIN (4–8 digits):</p>
          {pinInput(newPin, setNewPin, 'New PIN…')}
          <div className="flex gap-2">
            <button onClick={() => setMode('menu')} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
            <button
              onClick={() => {
                if (newPin.length < 4) { setError('PIN must be at least 4 digits.'); return }
                if (!/^\d+$/.test(newPin)) { setError('Numbers only.'); return }
                setError(''); setMode('setup-confirm')
              }}
              className="flex-1 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors"
            >Continue</button>
          </div>
        </div>
      )}

      {mode === 'setup-confirm' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Confirm your PIN:</p>
          {pinInput(confirmNewPin, setConfirmNewPin, 'Confirm PIN…')}
          <div className="flex gap-2">
            <button onClick={() => { setMode('setup-new'); setConfirmNewPin(''); setError('') }} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
            <button
              onClick={async () => {
                if (newPin !== confirmNewPin) { setError("PINs don't match."); setConfirmNewPin(''); return }
                setLoading(true)
                await savePin(newPin)
                setSessionPin(newPin)
                reinitializeStore(newPin)
                setLoading(false)
                setSuccess('PIN set! Your data is now AES-encrypted.')
                setMode('menu')
              }}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl transition-colors"
            >{loading ? 'Saving…' : 'Set PIN'}</button>
          </div>
          <div className="flex items-start gap-2 p-3 bg-brand-500/5 border border-brand-500/15 rounded-xl">
            <ShieldCheck size={13} className="text-brand-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">Your PIN encrypts all data with AES-256. Don't forget it — there's no recovery option.</p>
          </div>
        </div>
      )}

      {mode === 'change-old' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Enter your current PIN:</p>
          {pinInput(oldPin, setOldPin, 'Current PIN…')}
          <div className="flex gap-2">
            <button onClick={() => setMode('menu')} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
            <button onClick={handleChangeVerifyOld} disabled={loading} className="flex-1 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl transition-colors">
              {loading ? 'Verifying…' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {mode === 'change-new' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Enter your new PIN:</p>
          {pinInput(newPin, setNewPin, 'New PIN…')}
          <div className="flex gap-2">
            <button onClick={() => setMode('change-old')} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
            <button onClick={handleChangeNew} className="flex-1 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors">Continue</button>
          </div>
        </div>
      )}

      {mode === 'change-confirm' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Confirm your new PIN:</p>
          {pinInput(confirmNewPin, setConfirmNewPin, 'Confirm PIN…')}
          <div className="flex gap-2">
            <button onClick={() => setMode('change-new')} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Back</button>
            <button onClick={handleChangeConfirm} disabled={loading} className="flex-1 py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl transition-colors">
              {loading ? 'Saving…' : 'Save New PIN'}
            </button>
          </div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="space-y-3">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <p className="text-xs text-rose-400">Warning: removing the PIN will store your financial data as plaintext in your browser.</p>
          </div>
          <p className="text-sm text-gray-300">Enter current PIN to confirm:</p>
          {pinInput(oldPin, setOldPin, 'Current PIN…')}
          <div className="flex gap-2">
            <button onClick={() => setMode('menu')} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleRemovePin} disabled={loading} className="flex-1 py-2.5 text-sm font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl transition-colors">
              {loading ? 'Removing…' : 'Remove PIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
