import { useState } from 'react'
import { supabase } from '../../utils/supabase'
import { DollarSign, Mail, Lock, Eye, EyeOff, AlertTriangle, Loader2, UserPlus, LogIn, CheckCircle2 } from 'lucide-react'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('')   // set when email not yet confirmed

  const clear = () => { setError(''); setMessage(''); setUnconfirmedEmail('') }

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); clear()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      // Special-case: email not confirmed yet — show a helpful resend button
      if (err.message.toLowerCase().includes('email not confirmed') ||
          err.message.toLowerCase().includes('email_not_confirmed')) {
        setUnconfirmedEmail(email)
        setError('Email not confirmed yet. Check your inbox (and spam folder).')
      } else {
        setError(err.message)
      }
    }
    // On success, App.tsx listener handles the rest
  }

  const handleResendConfirmation = async () => {
    setLoading(true)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: unconfirmedEmail,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (err) setError(err.message)
    else { setMessage('Confirmation email resent! Check your inbox.'); setUnconfirmedEmail('') }
  }

  const handleSignup = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError("Passwords don't match."); return }
    setLoading(true); clear()
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (err) setError(err.message)
    else setMessage('Account created! Check your email to confirm, then log in.')
  }

  const handleReset = async () => {
    if (!email) { setError('Enter your email address.'); return }
    setLoading(true); clear()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (err) setError(err.message)
    else setMessage('Password reset email sent! Check your inbox.')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (mode === 'login') handleLogin()
    else if (mode === 'signup') handleSignup()
    else handleReset()
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

          {/* Mode tabs */}
          <div className="flex rounded-xl overflow-hidden border border-gray-700 mb-5">
            <button
              onClick={() => { setMode('login'); clear() }}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'login' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <LogIn size={13} /> Log In
            </button>
            <button
              onClick={() => { setMode('signup'); clear() }}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'signup' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserPlus size={13} /> Sign Up
            </button>
          </div>

          <div className="space-y-3" onKeyDown={handleKeyDown}>

            {/* Email */}
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => { setEmail(e.target.value); clear() }}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors text-sm"
              />
            </div>

            {/* Password */}
            {mode !== 'reset' && (
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clear() }}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {/* Confirm password (signup only) */}
            {mode === 'signup' && (
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clear() }}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors text-sm"
                />
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
                {unconfirmedEmail && (
                  <button
                    onClick={handleResendConfirmation}
                    disabled={loading}
                    className="w-full py-2 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            )}
            {message && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-xs text-emerald-400">{message}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset}
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Please wait…</>
                : mode === 'login' ? 'Log In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Email'
              }
            </button>

            {/* Forgot password */}
            {mode === 'login' && (
              <button
                onClick={() => { setMode('reset'); clear() }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
              >
                Forgot password?
              </button>
            )}
            {mode === 'reset' && (
              <button
                onClick={() => { setMode('login'); clear() }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
              >
                ← Back to login
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-700 mt-4">
          Your financial data is stored securely · No data is ever shared
        </p>
      </div>
    </div>
  )
}

// ── Update Password Screen (shown after clicking a password reset email link) ──

interface UpdatePasswordScreenProps {
  onDone: () => void
}

export function UpdatePasswordScreen({ onDone }: UpdatePasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleUpdate = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    // Give the user a moment to read the success message, then proceed
    setTimeout(onDone, 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-600/30">
            <DollarSign size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set New Password</h1>
          <p className="text-sm text-gray-400 mt-1">Choose a strong password for your account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-3">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-400" />
              <p className="text-sm text-emerald-400 font-medium">Password updated! Logging you in…</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors text-sm"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-brand-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors text-sm"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
              )}
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : 'Update Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
