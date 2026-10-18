import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, ExternalLink, Check, Plus, Info, Plane, Hotel, Utensils, Ticket, Bus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/FormField'
import { formatCurrency, formatDate } from '../../utils/finance'
import { askTripAssistant } from '../../utils/tripAssistantClient'
import { MAX_REQUEST_CHARS, type TripAssistantResult, type TripSuggestion } from '../../utils/tripAssistantTypes'
import type { Trip } from '../../types'

const CAT_COLORS: Record<string, string> = {
  flights: '#6366f1', hotel: '#0ea5e9', food: '#10b981',
  activities: '#f59e0b', transport: '#a855f7', shopping: '#f43f5e', other: '#6b7280',
}

interface Props {
  open: boolean
  onClose: () => void
  trip: Trip
  /** Adds one suggestion to the trip's expenses */
  onAdd: (item: TripSuggestion) => void
}

/**
 * Ask Claude (with web search) for flight/hotel/activity estimates, then add the
 * ones you like to the trip. Nothing is booked and nothing is added without a tap.
 */
export function TripAssistant({ open, onClose, trip, onAdd }: Props) {
  const [request, setRequest] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<TripAssistantResult | null>(null)
  const [error, setError] = useState<{ message: string; setup: boolean } | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const dates = trip.startDate && trip.endDate ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}` : 'my dates'
  const where = trip.destination || 'my destination'
  const starters = [
    { label: 'Flights', icon: Plane, text: `Round-trip flights to ${where}, ${dates}, 2 adults. Departing from ` },
    { label: 'Hotels', icon: Hotel, text: `Hotels in ${where} for ${dates}, 2 adults, under $200/night, good area for sightseeing` },
    { label: 'Food', icon: Utensils, text: `Typical daily food budget in ${where} for 2 adults (mix of casual and a few nice dinners)` },
    { label: 'Activities', icon: Ticket, text: `Top things to do in ${where} and what tickets cost` },
    { label: 'Getting around', icon: Bus, text: `Local transport costs in ${where} — airport transfer and getting around for ${dates}` },
  ]

  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  // Fresh start each time it opens
  useEffect(() => {
    if (open) { setResult(null); setError(null); setAdded(new Set()) }
    else abortRef.current?.abort()
  }, [open])

  const ask = async () => {
    if (!request.trim() || loading) return
    abortRef.current = new AbortController()
    setLoading(true); setElapsed(0); setError(null); setResult(null); setAdded(new Set())
    const res = await askTripAssistant({
      request,
      trip: {
        name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate,
        totalBudget: trip.totalBudget,
        existing: trip.expenses.map(e => ({ category: e.category, description: e.description, budgeted: e.budgeted })),
      },
    }, abortRef.current.signal)
    setLoading(false)
    if (res.ok) {
      setResult(res.result)
      if (res.result.items.length === 0) setError({ message: 'No options came back. Try being more specific.', setup: false })
    } else {
      setError({ message: res.message, setup: res.setup })
    }
  }

  const add = (item: TripSuggestion, i: number) => {
    if (added.has(i)) return
    onAdd(item)
    setAdded(s => new Set(s).add(i))
  }
  const notAdded = result ? result.items.map((it, i) => ({ it, i })).filter(x => !added.has(x.i)) : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trip assistant"
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">{added.size > 0 ? 'Done' : 'Close'}</Button>
          {loading ? (
            <Button variant="secondary" onClick={() => abortRef.current?.abort()} className="flex-1 justify-center">Cancel search</Button>
          ) : result && notAdded.length > 1 ? (
            <Button onClick={() => notAdded.forEach(x => add(x.it, x.i))} className="flex-1 justify-center">
              <Plus size={14} /> Add all ({notAdded.length})
            </Button>
          ) : (
            <Button onClick={ask} disabled={!request.trim()} className="flex-1 justify-center"><Sparkles size={14} /> Search</Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Request */}
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {starters.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setRequest(s.text)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-500"
              >
                <s.icon size={12} /> {s.label}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            maxLength={MAX_REQUEST_CHARS}
            value={request}
            onChange={e => setRequest(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask() }}
            placeholder={`e.g. Round-trip flights Houston → ${where}, ${dates}, 2 adults`}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            style={{ fontSize: '16px' }}
          />
          {result && !loading && (
            <button type="button" onClick={ask} className="text-xs text-brand-400 hover:text-brand-300 mt-1">Search again</button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-600/10 border border-brand-600/25">
            <Loader2 size={18} className="animate-spin text-brand-400 shrink-0" />
            <div>
              <p className="text-sm text-white">Searching the web for current prices… {elapsed}s</p>
              <p className="text-xs text-gray-400">Usually 20–60 seconds.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-300">
            {error.message}
            {error.setup && (
              <p className="text-xs text-gray-400 mt-1">
                In Vercel → AI Gateway, create an API key, then add it as <code className="text-gray-300">AI_GATEWAY_API_KEY</code> in your project's environment variables and redeploy.
              </p>
            )}
          </div>
        )}

        {result && result.items.length > 0 && (
          <div className="space-y-3">
            {result.summary && <p className="text-sm text-gray-300">{result.summary}</p>}
            {result.items.map((item, i) => {
              const isAdded = added.has(i)
              return (
                <div key={i} className={`rounded-xl border p-3 ${isAdded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-gray-700 bg-gray-800/50'}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: CAT_COLORS[item.category] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      {item.details && <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                        <span className="text-gray-500 capitalize">{item.category}</span>
                        {item.confidence === 'low' && <span className="text-amber-400">rough estimate</span>}
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300">
                            {item.sourceName || 'Source'} <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-white">{formatCurrency(item.estimatedCost)}</p>
                      {item.costBasis && <p className="text-[11px] text-gray-500 max-w-[9rem]">{item.costBasis}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(item, i)}
                    disabled={isAdded}
                    className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isAdded ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-600 hover:bg-brand-500 text-white'
                    }`}
                  >
                    {isAdded ? <><Check size={14} /> Added to trip</> : <><Plus size={14} /> Add to trip</>}
                  </button>
                </div>
              )
            })}
            {result.caveats.length > 0 && (
              <ul className="space-y-1">
                {result.caveats.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <Info size={12} className="text-sky-400 shrink-0 mt-0.5" /> {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-600">
          AI estimates from web search — not bookings or quotes. Prices change; check the source before you book.
        </p>
      </div>
    </Modal>
  )
}
