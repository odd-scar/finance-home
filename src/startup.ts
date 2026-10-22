/**
 * Runs before anything else loads (it's the first import in main.tsx), so stale
 * cached data is cleared before the app reads it. See services/cacheHygiene.ts.
 */
import { runStartupCacheHygiene, trackActivity } from './services/cacheHygiene'

runStartupCacheHygiene()
trackActivity()
