// PIN hashing via Web Crypto API (built into every browser — no library needed)
const PIN_HASH_KEY = '__fh_pin_hash'
const SESSION_KEY = '__fh_session'
const APP_SALT = 'finance-home-v1-salt' // app-specific, not secret

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + APP_SALT)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function savePin(pin: string): Promise<void> {
  const hash = await hashPin(pin)
  localStorage.setItem(PIN_HASH_KEY, hash)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY)
  if (!stored) return false
  const hash = await hashPin(pin)
  return hash === stored
}

export function hasPinSet(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY)
}

export function removePin(): void {
  localStorage.removeItem(PIN_HASH_KEY)
}

// Session: stored in sessionStorage so it clears when the browser tab closes
export function setSessionPin(pin: string): void {
  sessionStorage.setItem(SESSION_KEY, pin)
}

export function getSessionPin(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isSessionActive(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY)
}
