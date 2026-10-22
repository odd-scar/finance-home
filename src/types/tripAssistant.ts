// Shared by the Trip Planner UI and the /api/trip-assistant function

export const TRIP_ITEM_CATEGORIES = ['flights', 'hotel', 'food', 'activities', 'transport', 'shopping', 'other'] as const
export type TripItemCategory = typeof TRIP_ITEM_CATEGORIES[number]

/** One option the assistant found — an estimate, never a booking */
export interface TripSuggestion {
  category: TripItemCategory
  title: string
  details: string
  /** Estimated total in USD for the whole party and trip length */
  estimatedCost: number
  /** How the estimate was figured, e.g. "2 adults, round trip" or "$185/night × 9 nights" */
  costBasis: string
  /** Only links that appeared in the actual search results — empty if none */
  sourceUrl: string
  sourceName: string
  confidence: 'low' | 'medium' | 'high'
}

export interface TripAssistantResult {
  summary: string
  items: TripSuggestion[]
  caveats: string[]
}

/** What the UI sends along with the plain-English request */
export interface TripAssistantContext {
  name: string
  destination: string
  startDate: string
  endDate: string
  totalBudget: number
  /** Already-planned expenses, so suggestions don't duplicate them */
  existing: { category: string; description: string; budgeted: number }[]
}

export interface TripAssistantRequest {
  request: string
  trip: TripAssistantContext
}

export const MAX_REQUEST_CHARS = 600
