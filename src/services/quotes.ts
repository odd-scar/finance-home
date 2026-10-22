/**
 * Stock-price fetching + client-side caching layer.
 *
 * Prices are fetched via the /api/quote Vercel Edge Function which proxies
 * Yahoo Finance server-side — no API key is needed in the browser.
 *
 * Cache: each symbol is stored in localStorage for 1 hour so the app stays
 * snappy and avoids hammering the upstream service.
 */

const CACHE_KEY = 'finance-home-stock-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export interface QuoteResult {
  symbol: string
  price: number
  change: number
  changePercent: number
  previousClose: number
  latestTradingDay: string
}

interface CacheEntry {
  data: QuoteResult
  fetchedAt: number
}

type Cache = Record<string, CacheEntry>

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage quota — cache will just be in memory this session
  }
}

async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<QuoteResult>
}

export type FetchStatus = {
  success: string[]
  cached: string[]
  failed: string[]
  rateLimited: boolean
}

/**
 * Fetch live quotes for a list of symbols.
 * Uses a 1-hour client-side cache so repeated clicks don't re-hit the server.
 * Pass forceRefresh=true to bypass the cache.
 */
export async function fetchQuotes(
  symbols: string[],
  forceRefresh = false
): Promise<{ quotes: Record<string, QuoteResult | null>; status: FetchStatus }> {
  const cache = loadCache()
  const now = Date.now()
  const quotes: Record<string, QuoteResult | null> = {}
  const status: FetchStatus = { success: [], cached: [], failed: [], rateLimited: false }

  for (const symbol of symbols) {
    const cached = cache[symbol]
    const isFresh = cached && now - cached.fetchedAt < CACHE_TTL_MS

    if (isFresh && !forceRefresh) {
      quotes[symbol] = cached.data
      status.cached.push(symbol)
      continue
    }

    // Small delay between requests
    if (status.success.length > 0) {
      await new Promise(r => setTimeout(r, 200))
    }

    try {
      const data = await fetchQuote(symbol)
      cache[symbol] = { data, fetchedAt: now }
      quotes[symbol] = data
      status.success.push(symbol)
    } catch {
      quotes[symbol] = cached?.data ?? null
      status.failed.push(symbol)
    }
  }

  saveCache(cache)
  return { quotes, status }
}

export function getCachedQuote(symbol: string): QuoteResult | null {
  return loadCache()[symbol]?.data ?? null
}

export function getCacheAge(symbol: string): number | null {
  const entry = loadCache()[symbol]
  if (!entry) return null
  return Math.round((Date.now() - entry.fetchedAt) / 60000) // minutes
}
