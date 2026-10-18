/**
 * Vercel Function — 1 year of daily prices for analysis
 *
 * Fetches daily closes from Yahoo Finance server-side (no API key, no CORS).
 * Closes are split- and dividend-adjusted when Yahoo provides them, so returns
 * computed from them reflect what a holder actually earned.
 *
 * GET /api/history?symbol=AAPL
 */
export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.toUpperCase().trim()

  if (!symbol || !/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) {
    return json({ error: 'a valid symbol query param is required' }, 400)
  }

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1d&range=1y`

    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, */*',
      },
    })
    if (!upstream.ok) return json({ error: `Yahoo returned HTTP ${upstream.status}` }, 502)

    const data: YahooChartResponse = await upstream.json()
    const result = data?.chart?.result?.[0]
    if (!result?.timestamp?.length) return json({ error: `No history for "${symbol}"` }, 404)

    const raw = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? []
    const dates: string[] = []
    const closes: number[] = []
    result.timestamp.forEach((t, i) => {
      const c = raw[i]
      if (typeof c === 'number' && c > 0) {
        dates.push(new Date(t * 1000).toISOString().slice(0, 10))
        closes.push(Math.round(c * 10000) / 10000)
      }
    })

    const meta = result.meta ?? {}
    const body: HistoryResult = {
      symbol: meta.symbol ?? symbol,
      name: meta.longName ?? meta.shortName ?? null,
      type: meta.instrumentType ?? null,
      currency: meta.currency ?? null,
      price: meta.regularMarketPrice ?? closes[closes.length - 1] ?? null,
      high52: meta.fiftyTwoWeekHigh ?? (closes.length ? Math.max(...closes) : null),
      low52: meta.fiftyTwoWeekLow ?? (closes.length ? Math.min(...closes) : null),
      dates,
      closes,
    }

    return json(body, 200, {
      // Daily data — fresh for an hour, serve stale up to 6 hours while refreshing
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
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

interface HistoryResult {
  symbol: string
  name: string | null
  type: string | null
  currency: string | null
  price: number | null
  high52: number | null
  low52: number | null
  dates: string[]
  closes: number[]
}

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta?: {
        symbol?: string
        longName?: string
        shortName?: string
        instrumentType?: string
        currency?: string
        regularMarketPrice?: number
        fiftyTwoWeekHigh?: number
        fiftyTwoWeekLow?: number
      }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>
        adjclose?: Array<{ adjclose?: Array<number | null> }>
      }
    }> | null
  }
}
