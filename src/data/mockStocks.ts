import { Stock } from '../types'

// Realistic price ranges per symbol
const priceRanges: Record<string, { base: number; volatility: number }> = {
  AAPL: { base: 182, volatility: 0.015 },
  MSFT: { base: 415, volatility: 0.012 },
  NVDA: { base: 875, volatility: 0.025 },
  GOOGL: { base: 157, volatility: 0.014 },
  TSLA: { base: 198, volatility: 0.035 },
  VOO: { base: 485, volatility: 0.008 },
  AMZN: { base: 185, volatility: 0.016 },
  META: { base: 502, volatility: 0.018 },
  NFLX: { base: 615, volatility: 0.022 },
  AMD: { base: 178, volatility: 0.028 },
  INTC: { base: 42, volatility: 0.02 },
  DIS: { base: 112, volatility: 0.015 },
  COIN: { base: 218, volatility: 0.045 },
  SPY: { base: 512, volatility: 0.008 },
  QQQ: { base: 445, volatility: 0.01 },
}

function getBasePrice(symbol: string): number {
  const info = priceRanges[symbol.toUpperCase()]
  return info?.base ?? 50 + Math.random() * 200
}

function getVolatility(symbol: string): number {
  const info = priceRanges[symbol.toUpperCase()]
  return info?.volatility ?? 0.02
}

export function generatePriceHistory(symbol: string, currentPrice: number, points = 30): number[] {
  const vol = getVolatility(symbol)
  const history: number[] = [currentPrice]

  for (let i = 1; i < points; i++) {
    const change = 1 + (Math.random() - 0.5) * vol * 2
    history.unshift(Math.round(history[0] * change * 100) / 100)
  }

  return history
}

export function simulateRefresh(stocks: Stock[]): { id: string; currentPrice: number; priceHistory: number[] }[] {
  return stocks.map(stock => {
    const vol = getVolatility(stock.symbol)
    const change = 1 + (Math.random() - 0.48) * vol * 2 // slight upward bias
    const newPrice = Math.round(stock.currentPrice * change * 100) / 100
    const newHistory = [...stock.priceHistory.slice(1), newPrice]
    return { id: stock.id, currentPrice: newPrice, priceHistory: newHistory }
  })
}

export function getStockInfo(symbol: string): { name: string; currentPrice: number } {
  const names: Record<string, string> = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    NVDA: 'NVIDIA Corp.',
    GOOGL: 'Alphabet Inc.',
    TSLA: 'Tesla Inc.',
    VOO: 'Vanguard S&P 500 ETF',
    AMZN: 'Amazon.com Inc.',
    META: 'Meta Platforms Inc.',
    NFLX: 'Netflix Inc.',
    AMD: 'Advanced Micro Devices',
    INTC: 'Intel Corp.',
    DIS: 'Walt Disney Co.',
    COIN: 'Coinbase Global Inc.',
    SPY: 'SPDR S&P 500 ETF',
    QQQ: 'Invesco QQQ Trust',
  }

  const sym = symbol.toUpperCase()
  const base = getBasePrice(sym)
  const vol = getVolatility(sym)
  const spread = 1 + (Math.random() - 0.5) * vol * 4
  const currentPrice = Math.round(base * spread * 100) / 100

  return {
    name: names[sym] ?? `${sym} Inc.`,
    currentPrice,
  }
}
