import { useEffect, useState } from 'react'
import type { PriceHistory } from './stockAnalysis'

export const HISTORY_CACHE_KEY = 'finance-home-history-cache'
const TTL_MS = 6 * 60 * 60 * 1000 // daily data — 6 hours is plenty fresh
/** S&P 500 ETF used as the market benchmark */
export const BENCHMARK = 'SPY'

type Cache = Record<string, { data: PriceHistory; fetchedAt: number }>

function loadCache(): Cache {
  try { return JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '{}') } catch { return {} }
}

function saveCache(cache: Cache) {
  try { localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(cache)) } catch { /* quota — memory only */ }
}

async function fetchOne(symbol: string): Promise<PriceHistory> {
  const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as PriceHistory
  if (!Array.isArray(data.closes) || data.closes.length < 2) throw new Error('no history')
  return data
}

/** 1-year daily histories for the given symbols (cached on the device for 6 hours) */
export async function fetchHistories(symbols: string[]): Promise<{ histories: Record<string, PriceHistory>; failed: string[] }> {
  const cache = loadCache()
  const now = Date.now()
  const histories: Record<string, PriceHistory> = {}
  const failed: string[] = []

  for (const symbol of [...new Set(symbols)]) {
    const hit = cache[symbol]
    if (hit && now - hit.fetchedAt < TTL_MS) { histories[symbol] = hit.data; continue }
    try {
      const data = await fetchOne(symbol)
      cache[symbol] = { data, fetchedAt: now }
      histories[symbol] = data
    } catch {
      if (hit) histories[symbol] = hit.data // stale beats nothing
      else failed.push(symbol)
    }
  }

  saveCache(cache)
  return { histories, failed }
}

/** React hook: histories for the symbols plus the S&P 500 benchmark */
export function useHistories(symbols: string[]) {
  const key = [...new Set([...symbols, BENCHMARK])].sort().join(',')
  const [state, setState] = useState<{ histories: Record<string, PriceHistory>; failed: string[]; loading: boolean }>(
    { histories: {}, failed: [], loading: true }
  )

  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true }))
    fetchHistories(key.split(',').filter(Boolean))
      .then(r => { if (!cancelled) setState({ ...r, loading: false }) })
      .catch(() => { if (!cancelled) setState({ histories: {}, failed: key.split(','), loading: false }) })
    return () => { cancelled = true }
  }, [key])

  return state
}
