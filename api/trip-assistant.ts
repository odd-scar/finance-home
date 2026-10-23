/**
 * Vercel Function — AI trip assistant
 *
 * POST /api/trip-assistant   body: { request, trip }   header: Authorization: Bearer <supabase access token>
 *
 * Provider, in order:
 *   1. GEMINI_API_KEY      → Google Gemini with Google Search (free tier at aistudio.google.com)
 *   2. AI_GATEWAY_API_KEY  → Claude via Vercel AI Gateway with web search
 * Signed-in users only, and each account gets AI_DAILY_LIMIT searches per day
 * (default 10) so one person can't run up the AI bill. Node.js runtime;
 * maxDuration is set in vercel.json.
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, ApiError } from '@google/genai'
import { runTripAssistant, runGeminiAssistant, TripAssistantError } from '../src/server/tripAssistant.js'
import { MAX_REQUEST_CHARS, type TripAssistantRequest } from '../src/types/tripAssistant.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const supabaseUrl = () => process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const supabaseAnon = () => process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

/** Assistant searches one account gets per day. Override with AI_DAILY_LIMIT in Vercel. */
const dailyLimit = () => {
  const n = Number(process.env.AI_DAILY_LIMIT)
  return Number.isInteger(n) && n > 0 && n <= 500 ? n : 10
}

const bearerToken = (request: Request) =>
  request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null

/** True when the bearer token belongs to a signed-in Supabase user */
async function isSignedIn(token: string): Promise<boolean> {
  const url = supabaseUrl()
  const anon = supabaseAnon()
  if (!url || !anon) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Counts this call against the account's daily allowance and returns how many are
 * left afterwards, or -1 when the cap is already used up. The counting runs inside
 * a SECURITY DEFINER Postgres function that reads the account from the verified
 * JWT, so the browser can't claim a different user or reset its own counter.
 *
 * Fails closed: if the call can't be recorded, the AI doesn't run. Supabase has to
 * be reachable for the sign-in check above anyway, so this costs no uptime.
 */
async function claimDailyCall(token: string): Promise<number> {
  const url = supabaseUrl()
  const anon = supabaseAnon()
  if (!url || !anon) return -1
  try {
    const res = await fetch(`${url}/rest/v1/rpc/claim_ai_call`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_limit: dailyLimit() }),
    })
    if (!res.ok) {
      console.error('trip-assistant: daily cap check failed', res.status, await res.text().catch(() => ''))
      return -1
    }
    const left = Number(await res.json())
    return Number.isFinite(left) ? left : -1
  } catch (err) {
    console.error('trip-assistant: daily cap check unreachable', err)
    return -1
  }
}

function parseBody(body: unknown): TripAssistantRequest | null {
  const b = body as Partial<TripAssistantRequest> | null
  if (!b || typeof b.request !== 'string' || !b.request.trim() || !b.trip || typeof b.trip !== 'object') return null
  const t = b.trip
  return {
    request: b.request.trim().slice(0, MAX_REQUEST_CHARS),
    trip: {
      name: String(t.name ?? '').slice(0, 100),
      destination: String(t.destination ?? '').slice(0, 120),
      startDate: String(t.startDate ?? '').slice(0, 10),
      endDate: String(t.endDate ?? '').slice(0, 10),
      totalBudget: Number(t.totalBudget) || 0,
      existing: (Array.isArray(t.existing) ? t.existing : []).slice(0, 30).map(e => ({
        category: String(e?.category ?? '').slice(0, 30),
        description: String(e?.description ?? '').slice(0, 120),
        budgeted: Number(e?.budgeted) || 0,
      })),
    },
  }
}

const NOT_CONFIGURED = {
  error: 'ai_not_configured',
  message: 'Add GEMINI_API_KEY (free) or AI_GATEWAY_API_KEY in Vercel to turn on the trip assistant.',
}

export async function POST(request: Request): Promise<Response> {
  const geminiKey = process.env.GEMINI_API_KEY
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  if (!geminiKey && !gatewayKey) return json(NOT_CONFIGURED, 503)
  const token = bearerToken(request)
  if (!token || !(await isSignedIn(token))) {
    return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401)
  }

  // Spending guard: no single account can run up the AI bill.
  if ((await claimDailyCall(token)) < 0) {
    return json({
      error: 'daily_limit',
      message: `That’s all ${dailyLimit()} assistant searches for today. The limit resets at midnight UTC.`,
    }, 429)
  }

  const input = parseBody(await request.json().catch(() => null))
  if (!input) return json({ error: 'bad_request', message: 'Describe what you’re looking for.' }, 400)

  try {
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: 100_000 } })
      try {
        return json(await runGeminiAssistant(ai, input))
      } catch (err) {
        // Every Gemini model is out of quota: use AI Gateway instead when it's set up
        if (!(gatewayKey && err instanceof ApiError && err.status === 429)) throw err
        console.warn('trip-assistant: Gemini out of quota, falling back to AI Gateway')
      }
    }
    // Anthropic SDK pointed at Vercel AI Gateway's Anthropic-compatible endpoint
    const client = new Anthropic({ apiKey: gatewayKey, baseURL: 'https://ai-gateway.vercel.sh', timeout: 110_000, maxRetries: 1 })
    return json(await runTripAssistant(client, input))
  } catch (err) {
    if (err instanceof TripAssistantError) {
      return json({ error: err.code, message: err.message }, 422)
    }
    // Google errors
    if (err instanceof ApiError) {
      console.error('trip-assistant gemini error', err.status, err.message)
      if (err.status === 429 && /limit:\s*0\b/.test(err.message)) {
        return json({ error: 'upstream', message: 'This Gemini key has no free quota for the available models. Check your plan at aistudio.google.com.' }, 502)
      }
      if (err.status === 429) {
        return json({ error: 'busy', message: 'Google says this Gemini key is out of free quota right now (for every model tried), even if you haven’t searched today. Free limits usually reset at midnight Pacific. Check usage at ai.dev/rate-limit.' }, 429)
      }
      if ((err.status === 400 && /api key/i.test(err.message)) || err.status === 401 || err.status === 403) {
        return json({ error: 'ai_not_configured', message: 'Google rejected the GEMINI_API_KEY. Check that it was copied correctly in Vercel.' }, 503)
      }
      if (err.status === 404) {
        return json({ error: 'upstream', message: 'None of Google’s current Gemini models are available for this key. Check the key at aistudio.google.com.' }, 502)
      }
      return json({ error: 'upstream', message: 'The assistant hit a problem. Please try again.' }, 502)
    }
    // Anthropic errors
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'busy', message: 'The assistant is busy right now — try again in a minute.' }, 429)
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'ai_not_configured', message: 'The AI Gateway key isn’t valid. Check AI_GATEWAY_API_KEY in Vercel.' }, 503)
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return json({ error: 'timeout', message: 'That search took too long. Try a narrower request.' }, 504)
    }
    if (err instanceof Anthropic.APIError) {
      console.error('trip-assistant API error', err.status, err.message)
      return json({ error: 'upstream', message: 'The assistant hit a problem. Please try again.' }, 502)
    }
    console.error('trip-assistant error', err)
    return json({ error: 'internal', message: 'Something went wrong. Please try again.' }, 500)
  }
}
