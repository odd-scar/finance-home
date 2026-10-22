import { describe, it, expect } from 'vitest'
import { evaluate, isExpression, parseAmount, parseNumber } from '../lib/mathExpr'

describe('amount calculator', () => {
  it('adds a round trip (departure + return)', () => {
    expect(parseAmount('450+380')).toBe(830)
    expect(parseAmount('412.37 + 389.99')).toBe(802.36)
  })

  it('follows normal math order and parentheses', () => {
    expect(evaluate('100+50*2')).toBe(200)
    expect(evaluate('(100+50)*2')).toBe(300)
    expect(evaluate('1200/4-25')).toBe(275)
    expect(evaluate('-20+50')).toBe(30)
    expect(evaluate('2*-3')).toBe(-6)
  })

  it('accepts $, commas, spaces and the ×, ÷, − symbols', () => {
    expect(parseAmount('$1,200 + $350')).toBe(1550)
    expect(parseAmount('19.99 × 3')).toBe(59.97)
    expect(parseAmount('900 ÷ 3')).toBe(300)
    expect(parseAmount('500 − 120')).toBe(380)
    expect(parseAmount('85x2')).toBe(170)
  })

  it('rounds money to cents, keeps precision for rates/shares', () => {
    expect(parseAmount('10/3')).toBe(3.33)
    expect(parseNumber('10/3')).toBeCloseTo(3.33333, 4)
  })

  it('plain numbers still work exactly like before', () => {
    expect(parseAmount('1800')).toBe(1800)
    expect(parseAmount('15.5')).toBe(15.5)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('', 42)).toBe(42)
  })

  it('rejects anything that is not a calculation (no code can run)', () => {
    expect(evaluate('450+')).toBeNull()
    expect(evaluate('(450+380')).toBeNull()
    expect(evaluate('5/0')).toBeNull()
    expect(evaluate('1.2.3')).toBeNull()
    expect(evaluate('alert(1)')).toBeNull()
    expect(evaluate('process.exit()')).toBeNull()
    expect(parseAmount('abc', 0)).toBe(0)
  })

  it('knows when to show a live "= result" preview', () => {
    expect(isExpression('450+380')).toBe(true)
    expect(isExpression('(85)')).toBe(true)
    expect(isExpression('450')).toBe(false)
    expect(isExpression('-50')).toBe(false)
  })
})
