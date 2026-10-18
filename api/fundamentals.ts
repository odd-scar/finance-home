/**
 * Vercel Function — company fundamentals from SEC EDGAR (free, official filings)
 *
 * GET /api/fundamentals?symbol=AAPL
 *
 * The SEC requires every request to identify the caller with a contact email
 * (https://www.sec.gov/os/accessing-edgar-data). Set it in Vercel as the
 * SEC_USER_AGENT env var, e.g. "Finance Home you@example.com" — it's never
 * stored in the repo.
 *
 * Covers US-listed companies that file 10-Ks. Funds/ETFs and most foreign
 * companies don't report this way, so they return 404 with a clear message.
 */
import { extractFundamentals, type CompanyFacts } from '../src/utils/secFacts'

export const config = { runtime: 'edge' }

// Ticker → CIK map, reused while this function instance stays warm
let tickerMap: Map<string, { cik: number; title: string }> | null = null
let tickerMapAt = 0

async function lookupCik(symbol: string, ua: string) {
  if (!tickerMap || Date.now() - tickerMapAt > 24 * 60 * 60 * 1000) {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': ua } })
    if (!res.ok) throw new Error(`SEC ticker list HTTP ${res.status}`)
    const raw = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>
    tickerMap = new Map(Object.values(raw).map(r => [r.ticker.toUpperCase(), { cik: r.cik_str, title: r.title }]))
    tickerMapAt = Date.now()
  }
  // SEC writes class shares with a dash (BRK-B); brokers often use a dot (BRK.B)
  return tickerMap.get(symbol) ?? tickerMap.get(symbol.replace(/\./g, '-')) ?? null
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.toUpperCase().trim()
  if (!symbol || !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
    return json({ error: 'a valid symbol query param is required' }, 400)
  }

  const ua = process.env.SEC_USER_AGENT
  if (!ua || !ua.includes('@')) {
    return json({ error: 'sec_contact_missing', message: 'Set SEC_USER_AGENT in Vercel (e.g. "Finance Home you@example.com").' }, 503)
  }

  try {
    const entry = await lookupCik(symbol, ua)
    if (!entry) {
      return json({ error: 'not_found', message: `${symbol} isn't a US company that files with the SEC (funds/ETFs and most foreign stocks don't).` }, 404)
    }

    const cik10 = String(entry.cik).padStart(10, '0')
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`, { headers: { 'User-Agent': ua } })
    if (res.status === 404) return json({ error: 'not_found', message: `No financial statements on file for ${symbol}.` }, 404)
    if (!res.ok) return json({ error: `SEC returned HTTP ${res.status}` }, 502)

    const facts = (await res.json()) as CompanyFacts
    const fundamentals = extractFundamentals(facts, symbol, entry.cik)
    if (fundamentals.years.length === 0) {
      return json({ error: 'not_found', message: `${symbol} doesn't report US-GAAP annual statements the app can read.` }, 404)
    }

    return json(fundamentals, 200, {
      // Filings change a few times a year — cache a day, serve stale for a week
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: `Fetch failed: ${message}` }, 500)
  }
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
