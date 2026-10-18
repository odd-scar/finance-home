import { useEffect, useState } from 'react'
import type { Fundamentals } from './secFacts'

export const FUNDAMENTALS_CACHE_KEY = 'finance-home-fundamentals-cache'
const TTL_MS = 24 * 60 * 60 * 1000 // filings change a few times a year
const MAX_ENTRIES = 25

type Cache = Record<string, { data: Fundamentals; fetchedAt: number }>

function loadCache(): Cache {
  try { return JSON.parse(localStorage.getItem(FUNDAMENTALS_CACHE_KEY) || '{}') } catch { return {} }
}

function saveCache(cache: Cache) {
  // Keep only the most recent entries so storage stays small
  const trimmed = Object.fromEntries(
    Object.entries(cache).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, MAX_ENTRIES)
  )
  try { localStorage.setItem(FUNDAMENTALS_CACHE_KEY, JSON.stringify(trimmed)) } catch { /* quota */ }
}

export type FundamentalsState =
  | { status: 'loading' }
  | { status: 'ready'; data: Fundamentals }
  /** reason: 'not_found' (ETF/foreign/no filings) | 'setup' (SEC contact not configured) | 'error' */
  | { status: 'unavailable'; reason: 'not_found' | 'setup' | 'error'; message: string }

export async function fetchFundamentals(symbol: string): Promise<FundamentalsState> {
  const sym = symbol.toUpperCase()
  const cache = loadCache()
  const hit = cache[sym]
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return { status: 'ready', data: hit.data }

  try {
    const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(sym)}`)
    const body = await res.json().catch(() => null)
    if (res.ok && body?.years) {
      cache[sym] = { data: body as Fundamentals, fetchedAt: Date.now() }
      saveCache(cache)
      return { status: 'ready', data: body as Fundamentals }
    }
    if (hit) return { status: 'ready', data: hit.data } // stale beats nothing
    if (res.status === 404) return { status: 'unavailable', reason: 'not_found', message: body?.message ?? `No company filings found for ${sym}.` }
    if (body?.error === 'sec_contact_missing') return { status: 'unavailable', reason: 'setup', message: 'Business data needs a one-time setup (SEC contact email in Vercel).' }
    return { status: 'unavailable', reason: 'error', message: 'Couldn’t load company financials right now.' }
  } catch {
    if (hit) return { status: 'ready', data: hit.data }
    return { status: 'unavailable', reason: 'error', message: 'Couldn’t load company financials (offline?).' }
  }
}

export function useFundamentals(symbol: string | null): FundamentalsState | null {
  const [state, setState] = useState<FundamentalsState | null>(null)
  useEffect(() => {
    if (!symbol) { setState(null); return }
    let cancelled = false
    setState({ status: 'loading' })
    fetchFundamentals(symbol).then(s => { if (!cancelled) setState(s) })
    return () => { cancelled = true }
  }, [symbol])
  return state
}
