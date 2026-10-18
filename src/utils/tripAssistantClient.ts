import { supabase } from './supabase'
import type { TripAssistantRequest, TripAssistantResult } from './tripAssistantTypes'

export type TripAssistantResponse =
  | { ok: true; result: TripAssistantResult }
  | { ok: false; setup: boolean; message: string }

/** Ask the server-side assistant. Sends the user's login token so only signed-in users can use it. */
export async function askTripAssistant(body: TripAssistantRequest, signal?: AbortSignal): Promise<TripAssistantResponse> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, setup: false, message: 'Please sign in again to use the assistant.' }

    const res = await fetch('/api/trip-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.items) return { ok: true, result: json as TripAssistantResult }
    return {
      ok: false,
      setup: json?.error === 'ai_not_configured',
      // The status code makes a server crash (500) or timeout (504) easy to tell apart
      message: json?.message ?? (res.status === 404
        ? 'The assistant is available on the deployed app.'
        : `Something went wrong (error ${res.status}). Please try again.`),
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { ok: false, setup: false, message: 'Cancelled.' }
    return { ok: false, setup: false, message: 'Couldn’t reach the assistant (offline?).' }
  }
}
