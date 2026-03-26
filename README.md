# Finance Home

A polished personal finance dashboard built with React, TypeScript, Vite, and Tailwind CSS.

## Features

- **Dashboard** — Net worth overview, savings trend, income vs expenses, goal progress
- **Stocks** — Portfolio tracker with sparklines, trend prediction (linear regression), watchlist
- **Debt** — Track debts, avalanche vs snowball payoff calculator, payoff timeline chart
- **Savings** — Multiple accounts, goal tracking, compound interest growth projection
- **Goals** — Financial goal tracking with smart monthly savings suggestions
- **Trip Planner** — Budget trips by category, "can I afford this?" calculator, pie chart breakdown
- **Budget** — Monthly income/expense tracking, category breakdown, 6-month trend

## Setup

```bash
cd finance-home
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React icons
- date-fns
- uuid

## Data Persistence

All data is stored in `localStorage`. Demo data is pre-loaded on first launch. Use the "Reset Demo" button in the header to restore demo data at any time.

## Stock Prices

Uses simulated realistic prices with a "Refresh Prices" button that applies small random fluctuations. No API key required.
