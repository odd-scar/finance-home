import { describe, it, expect, beforeEach } from 'vitest'
import {
  hasPinSet,
  removePin,
  savePin,
  verifyPin,
  setSessionPin,
  getSessionPin,
  clearSession,
  isSessionActive,
  hashPin,
} from '../auth'

// localStorage and sessionStorage are provided by jsdom in the test environment

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// ── hashPin ────────────────────────────────────────────────────────────────

describe('hashPin', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await hashPin('1234')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('same PIN produces same hash (deterministic)', async () => {
    const h1 = await hashPin('9876')
    const h2 = await hashPin('9876')
    expect(h1).toBe(h2)
  })

  it('different PINs produce different hashes', async () => {
    const h1 = await hashPin('0000')
    const h2 = await hashPin('1111')
    expect(h1).not.toBe(h2)
  })
})

// ── hasPinSet / savePin / removePin ───────────────────────────────────────

describe('hasPinSet', () => {
  it('returns false when no PIN stored', () => {
    expect(hasPinSet()).toBe(false)
  })

  it('returns true after savePin', async () => {
    await savePin('4242')
    expect(hasPinSet()).toBe(true)
  })

  it('returns false after removePin', async () => {
    await savePin('4242')
    removePin()
    expect(hasPinSet()).toBe(false)
  })
})

// ── verifyPin ─────────────────────────────────────────────────────────────

describe('verifyPin', () => {
  it('returns false when no PIN is stored', async () => {
    expect(await verifyPin('1234')).toBe(false)
  })

  it('returns true with the correct PIN', async () => {
    await savePin('5678')
    expect(await verifyPin('5678')).toBe(true)
  })

  it('returns false with an incorrect PIN', async () => {
    await savePin('5678')
    expect(await verifyPin('9999')).toBe(false)
  })

  it('is case-sensitive — treats "1234" and "1234 " differently', async () => {
    await savePin('1234')
    expect(await verifyPin('1234 ')).toBe(false)
  })
})

// ── session management ────────────────────────────────────────────────────

describe('session management', () => {
  it('isSessionActive is false initially', () => {
    expect(isSessionActive()).toBe(false)
  })

  it('isSessionActive is true after setSessionPin', () => {
    setSessionPin('mypin')
    expect(isSessionActive()).toBe(true)
  })

  it('getSessionPin returns the PIN that was set', () => {
    setSessionPin('abc123')
    expect(getSessionPin()).toBe('abc123')
  })

  it('isSessionActive is false after clearSession', () => {
    setSessionPin('xyz')
    clearSession()
    expect(isSessionActive()).toBe(false)
  })

  it('getSessionPin returns null after clearSession', () => {
    setSessionPin('xyz')
    clearSession()
    expect(getSessionPin()).toBeNull()
  })
})
