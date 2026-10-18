/**
 * Trip Planner assistant (server-only — imported by api/trip-assistant.ts, never by the UI).
 *
 * Claude searches the web for current typical prices and returns structured
 * suggestions. It only *suggests*: nothing is booked, and nothing is added to the
 * user's trip until they tap "Add to trip" in the app.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  TRIP_ITEM_CATEGORIES, type TripAssistantRequest, type TripAssistantResult, type TripSuggestion, type TripItemCategory,
} from '../utils/tripAssistantTypes'

/** Claude Opus 5.5 through Vercel AI Gateway's Anthropic-compatible endpoint */
export const MODEL = 'anthropic/claude-opus-5.5'
const TOOL_NAME = 'suggest_trip_items'
const MAX_TURNS = 6
const MAX_ITEMS = 10

export class TripAssistantError extends Error {
  constructor(public code: 'refused' | 'no_result' | 'truncated', message: string) {
    super(message)
  }
}

const SYSTEM = `You help people budget trips inside a personal finance app.

Use web search to find current, typical prices for what the user asks about (flights, hotels, food, activities, local transport). Prefer recent sources and well-known booking or travel sites. Then call ${TOOL_NAME} exactly once with 3–8 concrete options.

Pricing rules:
- estimated_cost is the total in USD for the whole party for the whole trip (e.g. hotel = nightly rate × nights; flights = per-person fare × travelers). Explain the math in cost_basis.
- These are estimates for budgeting, not quotes or bookings. Say so in caveats when prices vary a lot (dates, season, fare class).
- source_url must be a URL that appeared in your search results; use "" if you have none. Never invent links.
- If the request is missing something important (dates, number of travelers), make a sensible assumption and state it in caveats rather than asking.`

const SUGGEST_TOOL = {
  name: TOOL_NAME,
  description: 'Return the trip options you found, with estimated costs, for the user to review and add to their trip budget.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['summary', 'items', 'caveats'],
    properties: {
      summary: { type: 'string', description: 'One or two sentences summarizing what you found.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'title', 'details', 'estimated_cost', 'cost_basis', 'source_url', 'source_name', 'confidence'],
          properties: {
            category: { type: 'string', enum: [...TRIP_ITEM_CATEGORIES] },
            title: { type: 'string', description: 'Short label, e.g. "United round trip IAH–NRT"' },
            details: { type: 'string', description: 'Key facts: dates, airline/hotel, area, what is included.' },
            estimated_cost: { type: 'number', description: 'Total USD for the whole party and trip.' },
            cost_basis: { type: 'string', description: 'How the total was figured.' },
            source_url: { type: 'string', description: 'A URL from your search results, or "".' },
            source_name: { type: 'string', description: 'Site name, e.g. "Google Flights" or "Booking.com".' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      caveats: { type: 'array', items: { type: 'string' }, description: 'Assumptions and things to double-check.' },
    },
  },
}

export function buildUserPrompt({ request, trip }: TripAssistantRequest, today: Date): string {
  const existing = trip.existing.length
    ? trip.existing.map(e => `- ${e.category}: ${e.description || '(no description)'} — $${e.budgeted}`).join('\n')
    : '- (nothing yet)'
  return [
    `Today is ${today.toISOString().slice(0, 10)}.`,
    `Trip: ${trip.name || 'Untitled'} — ${trip.destination || 'destination not set'}`,
    `Dates: ${trip.startDate || '?'} to ${trip.endDate || '?'}`,
    `Total budget: $${trip.totalBudget || 0}`,
    `Already planned:\n${existing}`,
    '',
    `Request: ${request}`,
  ].join('\n')
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const normUrl = (u: string) => u.replace(/\/+$/, '')

/**
 * Validate and clean the model's tool input before it reaches the UI: known
 * categories only, sane numbers, and links only if they came from real search results.
 */
export function sanitizeResult(raw: unknown, seenUrls: Set<string>): TripAssistantResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const seen = new Set([...seenUrls].map(normUrl))
  const items: TripSuggestion[] = (Array.isArray(obj.items) ? obj.items : [])
    .map((it): TripSuggestion | null => {
      const r = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
      const title = clip(r.title, 120)
      if (!title) return null
      const cost = typeof r.estimated_cost === 'number' && isFinite(r.estimated_cost) ? r.estimated_cost : 0
      const url = clip(r.source_url, 500)
      const urlOk = /^https?:\/\//i.test(url) && seen.has(normUrl(url))
      const category = (TRIP_ITEM_CATEGORIES as readonly string[]).includes(r.category as string)
        ? (r.category as TripItemCategory) : 'other'
      const confidence = r.confidence === 'low' || r.confidence === 'high' ? r.confidence : 'medium'
      return {
        category,
        title,
        details: clip(r.details, 400),
        estimatedCost: Math.round(Math.min(Math.max(cost, 0), 1_000_000) * 100) / 100,
        costBasis: clip(r.cost_basis, 160),
        sourceUrl: urlOk ? url : '',
        sourceName: clip(r.source_name, 80),
        confidence,
      }
    })
    .filter((x): x is TripSuggestion => x !== null)
    .slice(0, MAX_ITEMS)

  return {
    summary: clip(obj.summary, 600),
    items,
    caveats: (Array.isArray(obj.caveats) ? obj.caveats : []).map(c => clip(c, 240)).filter(Boolean).slice(0, 6),
  }
}

/** Run the search → suggest loop and return cleaned suggestions */
export async function runTripAssistant(
  client: Anthropic,
  req: TripAssistantRequest,
  today: Date = new Date()
): Promise<TripAssistantResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildUserPrompt(req, today) }]
  const seenUrls = new Set<string>()
  let useFallbacks = true
  let nudged = false

  const create = (withFallbacks: boolean) =>
    client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
        SUGGEST_TOOL,
      ],
      output_config: { effort: 'medium' },
      // Server-side refusal fallback ("default" routes by refusal category)
      ...(withFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response: Anthropic.Beta.BetaMessage
    try {
      response = await create(useFallbacks)
    } catch (err) {
      // If the gateway doesn't accept the fallback option, retry once without it
      if (useFallbacks && err instanceof Anthropic.BadRequestError) {
        useFallbacks = false
        response = await create(false)
      } else {
        throw err
      }
    }

    // Remember every link the search actually returned
    for (const block of response.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) seenUrls.add(r.url)
      }
    }

    if (response.stop_reason === 'refusal') {
      throw new TripAssistantError('refused', 'The assistant declined this request. Try rephrasing it.')
    }

    const call = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME
    )
    if (call) return sanitizeResult(call.input, seenUrls)

    if (response.stop_reason === 'max_tokens') {
      throw new TripAssistantError('truncated', 'The answer was too long. Try asking about fewer things at once.')
    }

    // Long searches can pause — hand the turn back so the server resumes it
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    // Answered in prose instead of calling the tool: ask once for the structured list
    if (!nudged) {
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: `Please call ${TOOL_NAME} now with the options you found.` })
      nudged = true
      continue
    }
    break
  }
  throw new TripAssistantError('no_result', 'The assistant couldn’t put together suggestions. Try a more specific request.')
}
