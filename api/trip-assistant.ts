/**
 * Vercel Function — AI trip assistant
 *
 * POST /api/trip-assistant   body: { request, trip }   header: Authorization: Bearer <supabase access token>
 *
 * Provider, in order:
 *   1. GEMINI_API_KEY      → Google Gemini with Google Search (free tier at aistudio.google.com)
 *   2. AI_GATEWAY_API_KEY  → Claude via Vercel AI Gateway with web search
 * Signed-in users only, so nobody else can spend the AI budget. Node.js runtime;
 * maxDuration is set in vercel.json.
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI, ApiError } from '@google/genai'
import { runTripAssistant, runGeminiAssistant, TripAssistantError } from '../src/server/tripAssistant.js'
import { MAX_REQUEST_CHARS, type TripAssistantRequest } from '../src/utils/tripAssistantTypes.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** True when the bearer token belongs to a signed-in Supabase user */
async function isSignedIn(request: Request): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
    return res.ok
  } catch {
    return false
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
  if (!(await isSignedIn(request))) {
    return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401)
  }

  const input = parseBody(await request.json().catch(() => null))
  if (!input) return json({ error: 'bad_request', message: 'Describe what you’re looking for.' }, 400)

  try {
    if (geminiKey) {
      const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: 100_000 } })
      return json(await runGeminiAssistant(ai, input))
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
        return json({ error: 'busy', message: 'The free Gemini limit was reached for now — try again in a minute (or tomorrow).' }, 429)
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
