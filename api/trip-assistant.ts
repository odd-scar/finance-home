/**
 * Vercel Function — AI trip assistant
 *
 * POST /api/trip-assistant   body: { request, trip }   header: Authorization: Bearer <supabase access token>
 *
 * Calls Claude through Vercel AI Gateway (AI_GATEWAY_API_KEY) with web search and
 * returns structured trip suggestions. Signed-in users only, so nobody else can
 * spend the AI budget. Runs on the Node.js runtime; maxDuration is set in vercel.json.
 */
import Anthropic from '@anthropic-ai/sdk'
import { runTripAssistant, TripAssistantError } from '../src/server/tripAssistant'
import { MAX_REQUEST_CHARS, type TripAssistantRequest } from '../src/utils/tripAssistantTypes'

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

export async function POST(request: Request): Promise<Response> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return json({ error: 'ai_not_configured', message: 'Add AI_GATEWAY_API_KEY in Vercel to turn on the trip assistant.' }, 503)
  }
  if (!(await isSignedIn(request))) {
    return json({ error: 'unauthorized', message: 'Please sign in again.' }, 401)
  }

  const input = parseBody(await request.json().catch(() => null))
  if (!input) return json({ error: 'bad_request', message: 'Describe what you’re looking for.' }, 400)

  // Anthropic SDK pointed at Vercel AI Gateway's Anthropic-compatible endpoint
  const client = new Anthropic({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh',
    timeout: 110_000,
    maxRetries: 1,
  })

  try {
    const result = await runTripAssistant(client, input)
    return json(result)
  } catch (err) {
    if (err instanceof TripAssistantError) {
      return json({ error: err.code, message: err.message }, 422)
    }
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
