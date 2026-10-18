import { describe, it, expect, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { runTripAssistant, sanitizeResult, buildUserPrompt, TripAssistantError } from '../../server/tripAssistant'
import type { TripAssistantRequest } from '../tripAssistantTypes'

const req: TripAssistantRequest = {
  request: 'Round trip flights Houston to Tokyo, 2 adults',
  trip: {
    name: 'Japan 2026', destination: 'Tokyo', startDate: '2026-05-03', endDate: '2026-05-12', totalBudget: 6000,
    existing: [{ category: 'hotel', description: 'Shinjuku hotel', budgeted: 1800 }],
  },
}

const REAL = 'https://www.google.com/travel/flights/iah-nrt'
const searchBlock = (urls: string[]) => ({
  type: 'web_search_tool_result',
  tool_use_id: 'srv_1',
  content: urls.map(url => ({ type: 'web_search_result', url, title: 't', encrypted_content: 'x', page_age: null })),
})
const toolCall = (input: unknown) => ({ type: 'tool_use', id: 'tu_1', name: 'suggest_trip_items', input })
const msg = (stop_reason: string, content: unknown[]) => ({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason, content, usage: {} })

const goodInput = {
  summary: 'Found fares.',
  items: [{
    category: 'flights', title: 'United IAH–NRT', details: 'Nonstop', estimated_cost: 2400.456,
    cost_basis: '$1,200 × 2 adults', source_url: REAL, source_name: 'Google Flights', confidence: 'high',
  }],
  caveats: ['Prices vary by date.'],
}

function fakeClient(...responses: Array<unknown | Error>) {
  const create = vi.fn()
  for (const r of responses) {
    if (r instanceof Error) create.mockRejectedValueOnce(r)
    else create.mockResolvedValueOnce(r)
  }
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create }
}

describe('sanitizeResult', () => {
  it('keeps real links, drops invented ones, and cleans values', () => {
    const r = sanitizeResult({
      summary: 's',
      items: [
        { ...goodInput.items[0] },
        { ...goodInput.items[0], title: 'Made-up deal', source_url: 'https://totally-real-deals.example/xyz' },
        { ...goodInput.items[0], title: 'Weird', category: 'spaceship', estimated_cost: -50, confidence: 'certain' },
        { ...goodInput.items[0], title: '' },
      ],
      caveats: ['ok', 42],
    }, new Set([REAL + '/']))
    expect(r.items).toHaveLength(3)                       // empty title dropped
    expect(r.items[0].sourceUrl).toBe(REAL)               // seen (trailing slash ignored)
    expect(r.items[0].estimatedCost).toBe(2400.46)        // rounded to cents
    expect(r.items[1].sourceUrl).toBe('')                 // never shown: not from the search
    expect(r.items[2]).toMatchObject({ category: 'other', estimatedCost: 0, confidence: 'medium' })
    expect(r.caveats).toEqual(['ok'])
  })

  it('handles garbage input without throwing', () => {
    expect(sanitizeResult(null, new Set())).toEqual({ summary: '', items: [], caveats: [] })
  })
})

describe('buildUserPrompt', () => {
  it('includes the trip details and what is already planned', () => {
    const p = buildUserPrompt(req, new Date('2026-10-17T12:00:00Z'))
    expect(p).toContain('Today is 2026-10-17')
    expect(p).toContain('Tokyo')
    expect(p).toContain('2026-05-03 to 2026-05-12')
    expect(p).toContain('hotel: Shinjuku hotel — $1800')
    expect(p).toContain('Request: Round trip flights Houston to Tokyo')
  })
})

describe('runTripAssistant', () => {
  it('resumes a paused search and remembers links from every round', async () => {
    const { client, create } = fakeClient(
      msg('pause_turn', [searchBlock([REAL])]),
      msg('tool_use', [toolCall(goodInput)]),
    )
    const r = await runTripAssistant(client, req)
    expect(create).toHaveBeenCalledTimes(2)
    expect(r.items[0].sourceUrl).toBe(REAL)
    // The paused turn is handed back so the server can continue it
    const second = create.mock.calls[1][0]
    expect(second.messages.at(-1).role).toBe('assistant')
    // Current model, web search capped, structured tool, explicit effort
    expect(second.model).toBe('anthropic/claude-opus-5.5')
    expect(second.tools[0]).toMatchObject({ type: 'web_search_20260209', max_uses: 6 })
    expect(second.tools[1]).toMatchObject({ name: 'suggest_trip_items', strict: true })
    expect(second.output_config).toEqual({ effort: 'medium' })
    expect(second.fallbacks).toBe('default')
  })

  it('retries once without refusal fallbacks if the gateway rejects them', async () => {
    const bad = new Anthropic.BadRequestError(400, { error: { message: 'unknown field fallbacks' } }, 'unknown field fallbacks', new Headers())
    const { client, create } = fakeClient(bad, msg('tool_use', [toolCall(goodInput)]))
    const r = await runTripAssistant(client, req)
    expect(r.items).toHaveLength(1)
    expect(create.mock.calls[0][0].fallbacks).toBe('default')
    expect(create.mock.calls[1][0].fallbacks).toBeUndefined()
    expect(create.mock.calls[1][0].betas).toBeUndefined()
  })

  it('asks once for the structured list when the answer comes back as prose', async () => {
    const { client, create } = fakeClient(
      msg('end_turn', [{ type: 'text', text: 'Flights are about $1,200.' }]),
      msg('tool_use', [toolCall(goodInput)]),
    )
    const r = await runTripAssistant(client, req)
    expect(r.items[0].title).toBe('United IAH–NRT')
    expect(create.mock.calls[1][0].messages.at(-1)).toMatchObject({ role: 'user' })
  })

  it('reports a refusal clearly', async () => {
    const { client } = fakeClient(msg('refusal', []))
    await expect(runTripAssistant(client, req)).rejects.toMatchObject({ code: 'refused' })
    await expect(runTripAssistant(fakeClient(msg('refusal', [])).client, req)).rejects.toBeInstanceOf(TripAssistantError)
  })
})
