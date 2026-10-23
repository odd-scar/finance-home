# Finance Home — Things to Look Out For

## The Stack Is Fine — Don't Migrate

React + TypeScript + Vite is a genuinely good choice for this app. It's fast, the tooling is excellent, and the PWA setup (installable, offline-capable, mobile-friendly) is the right call for a personal finance app used daily on a phone. Next.js and Remix would add server-side complexity without any benefit — all data is user-specific and behind auth, so there's nothing to SSR or SEO. Migration cost: high. User-visible gain: zero.

---

## What's Actually Good

The store pattern is cleverer than it looks. It's essentially a tiny Redux without the boilerplate — module-level state, a `commit()` function, listeners for subscriptions, debounced Supabase sync. For a personal app with a single user, this is fine and far simpler than setting up Redux or a context tree.

The localStorage-as-offline-cache plus Supabase-as-cloud-backup architecture is solid. The 10-second timeout on `loadFromSupabase` to prevent infinite loading screens is a thoughtful detail. The PWA Workbox config (NetworkFirst for `/api/quote`, cache-first for the app shell) is correct.

---

## What's Painful

### 1. The Store Has No Selective Subscriptions

Every `commit()` notifies every listener, which means every component that subscribes re-renders on every state change — adding a note triggers re-renders in the stocks widget. This works fine at current scale but will get noisy as the app grows. Module-level mutable state is also invisible to React DevTools.

**Fix**: Replace the custom store with [Zustand](https://zustand-demo.pmnd.rs/). It's ~1KB, uses the exact same pattern (a single store, actions that mutate state), but gives you selector-based subscriptions (components only re-render when their slice changes) and DevTools integration. Migration is roughly a day of work and is a straight-up improvement with no downsides.

---

### 2. The Entire State Is One Blob — This Will Bite You

Every change — adding a single note, updating one stock price, checking off a bill — serializes and writes the entire `AppState` to localStorage *and* schedules a Supabase upsert of the whole thing.

**Concrete example of how this becomes a problem:**

Say it's 2027 and you've got 24 months of budget entries (~40 entries/month = ~960 rows), 3 years of net worth snapshots, trip expenses from a dozen trips, and stock price history arrays. Your `AppState` JSON blob is now 800KB. Every time you check off a bill — one boolean flip — the app:

1. `JSON.stringify`s the entire 800KB object
2. Writes it to localStorage (synchronous, blocks the main thread)
3. Fires a Supabase upsert 2 seconds later, sending 800KB over the network

localStorage has a hard cap of 5–10MB depending on the browser. At that blob size you're already using 10–15% of the budget from normal usage. Add encrypted data (which inflates size ~33%) and you could realistically hit the limit in a couple of years of active use. When that happens, the `try/catch` in `commit()` **silently swallows the error** — saves stop persisting locally and you won't know until data is missing.

The Supabase side is not a hard limit on the free tier, but doing a full row replacement on every interaction (debounced, but still) is real write amplification.

**Fix when the time comes**: Split the Supabase schema into separate tables (`stocks`, `budget`, `trips`, etc.) and use row-level upserts per entity instead of one giant blob. For localStorage, either increase granularity (one key per data type) or drop localStorage entirely once Supabase is the source of truth with a proper offline strategy.

---

### 3. Two Tabs Open = Risk of Data Loss

The debounced sync is last-write-wins. Open the app on your phone and laptop simultaneously, make changes on both, and whichever syncs last wins — the other's changes are silently overwritten. This is an acceptable tradeoff for a personal app, but worth knowing it's there.

---

### 4. No Data-Fetching Layer for Stock Prices

Stock price fetches appear to be ad-hoc (the Workbox config references `/api/quote`). If you're not already using something like [TanStack Query](https://tanstack.com/query), it's worth adding — you get loading/error states, background refetch, deduplication, and cache management for free.

---

## Hosting Without Vercel

**Cloudflare Pages** is the best free option. Global CDN, zero cold starts, custom domain is free, and the free tier is genuinely unlimited for static assets.

**Setup:**
1. Push to GitHub
2. Connect repo to Cloudflare Pages, set build command to `npm run build`, output directory to `dist`
3. Add your custom domain in the Cloudflare dashboard

**Required step for SPA routing** — create `public/_redirects` with this one line:
```
/* /index.html 200
```
Without this, refreshing the page or navigating directly to a route returns a 404 because the server looks for a real file at that path. This tells Cloudflare to always serve `index.html` and let React handle routing.

**Netlify** is equally good and nearly identical in setup. Same `_redirects` trick applies, or use a `netlify.toml`. Custom domains are free.

**GitHub Pages** works but is more annoying for SPAs — you need a 404.html redirect trick and it's fiddlier. Skip it unless you specifically want to stay in the GitHub ecosystem.

**Bottom line**: Cloudflare Pages → set up in 10 minutes, custom domain free, no gotchas.

---

## Scaling to Multiple Users

The frontend (static SPA on a CDN) scales to infinite users for free. The real bottlenecks are more specific.

### What Actually Breaks Under Load

**Stock price API — this is the real problem.** Every user independently hits `/api/quote` to fetch prices. If 200 users open the app in the morning, that's 200 simultaneous calls to whatever stock API you're using (Alpha Vantage, Yahoo Finance, etc.). Most free tiers cap at 5–25 requests/minute. You'll get rate-limited immediately and users will see stale or missing prices.

**Supabase free tier limits.** The free plan gives 500MB of database storage and 2GB of bandwidth/month. With the blob-per-user schema, 1000 active users each with a 500KB state blob = 500MB in database storage alone, plus every save sends the full blob over the wire. You'd blow through both limits.

**RLS (Row-Level Security).** If it's not enabled on the `user_data` table, any authenticated user can technically read any other user's financial data. That's a serious bug at scale, not just a performance issue.

### Fix 1 — Share a Stock Price Cache (highest leverage)

Create a `stock_prices` table in Supabase:

```sql
CREATE TABLE stock_prices (
  ticker TEXT PRIMARY KEY,
  price NUMERIC,
  updated_at TIMESTAMPTZ
);
```

Then use a **Supabase Edge Function + pg_cron** to refresh prices every 15 minutes for all tickers any user holds. Users read from this table instead of hitting the external API directly. 200 users → 1 API call per ticker per 15 min instead of 200.

### Fix 2 — Normalize the Database Schema (when you go public)

Instead of one `user_data` row with a giant JSON blob, split into proper tables:

```
stocks        (id, user_id, ticker, shares, ...)
budget_entries (id, user_id, month, year, amount, ...)
debts         (id, user_id, ...)
```

Each write then touches one row in one table instead of rewriting everything. Also unlocks queries across users (e.g. "which tickers do all users hold?" for the price cache above). This is a significant refactor — worth doing if you go public, not before.

### Fix 3 — Upgrade Supabase (when limits get close)

The Pro plan is $25/month and removes virtually all the limits that matter (8GB storage, 50GB bandwidth, no connection limits). The free tier is fine for personal use or a small beta.

### Fix 4 — Enable RLS Now

In your Supabase dashboard → Table Editor → `user_data` → make sure Row Level Security is enabled with a policy like:

```sql
CREATE POLICY "own data only" ON user_data
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

If RLS is off, a determined user could query the API directly and read everyone's financial data.

---

## Priority Order

| Priority | Item |
|----------|------|
| **Do now** | Verify RLS is enabled on `user_data` |
| Low / when it hurts | Migrate store to Zustand |
| Medium / watch it grow | Monitor localStorage usage as data accumulates |
| Low / if you add more tabs | Two-tab data loss — not a problem for solo use |
| Low / if stock fetching gets complex | Add TanStack Query |
| When ready to deploy | Set up Cloudflare Pages + `_redirects` file |
| Before opening to more users | Shared stock price cache (Edge Function + pg_cron) |
| If you go public | Normalize Supabase schema into separate tables |
| When free tier limits approach | Upgrade to Supabase Pro ($25/mo) |
