/**
 * Vercel Edge Function — stock quote proxy
 *
 * Fetches real-time price data from Yahoo Finance so the API key (if any)
 * never has to live in the browser. No credentials required — Yahoo Finance
 * is called server-side where there are no CORS restrictions.
 *
 * GET /api/quote?symbol=AAPL
 */
export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.toUpperCase().trim()

  if (!symbol) {
    return json({ error: 'symbol query param is required' }, 400)
  }

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1d&range=5d`

    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, */*',
      },
    })

    if (!upstream.ok) {
      return json({ error: `Yahoo returned HTTP ${upstream.status}` }, 502)
    }

    const data: YahooChartResponse = await upstream.json()
    const result = data?.chart?.result?.[0]

    if (!result) {
      return json({ error: `No data found for symbol "${symbol}"` }, 404)
    }

    const meta = result.meta
    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
    const change = price - prevClose
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0

    const quote: QuoteResult = {
      symbol: meta.symbol ?? symbol,
      price: round(price),
      change: round(change),
      changePercent: round(changePercent),
      previousClose: round(prevClose),
      latestTradingDay: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    }

    return json(quote, 200, {
      // Edge cache: fresh for 15 min, stale-while-revalidate for another 45 min
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=2700',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: `Fetch failed: ${message}` }, 500)
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function round(n: number, decimals = 4): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals
}

// ── types ──────────────────────────────────────────────────────────────────

interface QuoteResult {
  symbol: string
  price: number
  change: number
  changePercent: number
  previousClose: number
  latestTradingDay: string
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        symbol?: string
        regularMarketPrice?: number
        previousClose?: number
        chartPreviousClose?: number
        regularMarketTime?: number
      }
    }> | null
    error?: unknown
  }
}
