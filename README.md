# Finance Home

A personal finance app: budget, bills, savings, goals, debt, stocks, and trip planning in one place.
It runs in the browser, installs to a phone's home screen (PWA), and syncs across devices with Supabase.

## Features

- **Budget**: One screen for the month. Bills and recurring costs are counted as *fixed*. You plan the
  flexible categories (dining out, gas, shopping…), log spending with a quick form (`12+8` works),
  and compare planned vs actual in a list or bar chart. Supports a zero-based mode and "Cover it" to
  move money between plans. Logging a savings transfer can also add to a savings account and a goal.
- **Dashboard**: Net worth, cash flow, and dismissible alerts.
- **Bills**: Recurring bills with due dates and autopay.
- **Savings / Goals / Debt**: Accounts with history, goal tracking, and avalanche vs snowball payoff.
- **Stocks**: Live quotes, a holdings list you can reorder, a watchlist, trend analysis, and a business analysis built from SEC filings.
- **Trip Planner**: Trip budgets plus an optional AI assistant that suggests flights and hotels.
- **Privacy**: Optional PIN lock. Cached data is cleared when the app is reopened or after 3 days unused.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build
```

## Where things live

```
api/                    Vercel serverless functions (run on the server, never in the browser)
  quote.ts              live stock price (Yahoo Finance)
  history.ts            1 year of daily prices
  fundamentals.ts       company financials from SEC EDGAR
  trip-assistant.ts     AI trip suggestions (Gemini or Claude via AI Gateway)

src/
  main.tsx, App.tsx     app entry, navigation, quick-add menu
  startup.ts            runs first: automatic cache clearing
  components/<Screen>/  one folder per screen (Budget, Bills, Stocks, …)
  components/ui/        shared building blocks (Modal, Card, MoneyInput, …)
  store/store.ts        all app data + every action that changes it; saves locally and syncs to Supabase
  hooks/                React hooks (useAppStore subscribes a component to the store)
  lib/                  pure logic with no network or storage: easy to test
    finance.ts          money formatting, dates, payoff and growth math
    budgetMath.ts       month totals, plan vs actual, fixed vs flexible, zero-based
    categories.ts       category lists and colors
    mathExpr.ts         calculator for money inputs (no eval)
    stockAnalysis.ts    trend, volatility, and return stats
    businessAnalysis.ts / secFacts.ts   ratios from SEC filings
  services/             anything that talks to the network or browser storage
    supabase.ts         Supabase client (login + cloud sync)
    quotes.ts, stockHistory.ts, fundamentals.ts, tripAssistant.ts   callers for the api/ functions
    appCache.ts, cacheHygiene.ts        clearing caches (manual and automatic)
    pinLock.ts, cryptoStore.ts          PIN lock and local encryption helpers
  server/               code used only by api/ functions (trip assistant prompts and parsing)
  types/                shared TypeScript types
  data/                 demo data and sample stocks
  __tests__/            unit tests
```

## Environment variables (set in Vercel, never committed)

| Name | Used for |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | login and cloud sync |
| `SEC_USER_AGENT` | required by the SEC, e.g. `Finance Home you@example.com` |
| `GEMINI_API_KEY` *(free tier)* or `AI_GATEWAY_API_KEY` | trip assistant (optional) |

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Recharts, Supabase, vite-plugin-pwa, and Vercel Functions.
