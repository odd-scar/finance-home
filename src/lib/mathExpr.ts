/**
 * Tiny calculator for amount fields: "450 + 380", "1,200 / 2", "(85 + 40) * 3", "$19.99x2".
 *
 * A hand-written parser (no eval) that only understands numbers, + − × ÷ and
 * parentheses, so nothing typed into a field can ever run as code.
 */

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string }

function tokenize(input: string): Tok[] | null {
  const s = input
    .replace(/[$,\s]/g, '')         // "$1,200 " → "1200"
    .replace(/[×xX*]/g, '*')
    .replace(/[÷/]/g, '/')
    .replace(/[−–—]/g, '-')         // typographic minus signs
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const raw = s.slice(i, j)
      if ((raw.match(/\./g) ?? []).length > 1 || raw === '.') return null
      out.push({ t: 'num', v: parseFloat(raw) })
      i = j
    } else if ('+-*/()'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
    } else {
      return null
    }
  }
  return out
}

/** Evaluate an amount expression. Returns null when empty or not a valid expression. */
export function evaluate(input: string): number | null {
  if (!input || !input.trim()) return null
  const parsed = tokenize(input)
  if (!parsed || parsed.length === 0) return null
  const toks: Tok[] = parsed
  let pos = 0
  const peek = () => toks[pos]
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v

  // expr := term (('+'|'-') term)*   term := factor (('*'|'/') factor)*
  // factor := ('+'|'-') factor | number | '(' expr ')'
  function expr(): number | null {
    let left = term()
    while (left !== null && (isOp('+') || isOp('-'))) {
      const op = toks[pos++].v
      const right = term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  function term(): number | null {
    let left = factor()
    while (left !== null && (isOp('*') || isOp('/'))) {
      const op = toks[pos++].v
      const right = factor()
      if (right === null) return null
      if (op === '/' && right === 0) return null
      left = op === '*' ? left * right : left / right
    }
    return left
  }
  function factor(): number | null {
    const tok = peek()
    if (!tok) return null
    if (tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
      pos++
      const f = factor()
      return f === null ? null : tok.v === '-' ? -f : f
    }
    if (tok.t === 'num') { pos++; return tok.v }
    if (tok.t === 'op' && tok.v === '(') {
      pos++
      const v = expr()
      if (v === null || !isOp(')')) return null
      pos++
      return v
    }
    return null
  }

  const result = expr()
  if (result === null || pos !== toks.length || !isFinite(result)) return null
  return result
}

/** True when the text is a calculation rather than a plain number */
export function isExpression(input: string): boolean {
  return /\d\s*[-+*/×xX÷−]\s*[\d(]/.test(input) || /[()]/.test(input)
}

/**
 * Read an amount field: plain numbers or calculations. Money is rounded to cents.
 * Use this instead of parseFloat so "450+380" saves 830, not 450.
 */
export function parseAmount(input: string | undefined | null, fallback = 0): number {
  const v = evaluate(input ?? '')
  return v === null ? fallback : Math.round(v * 100) / 100
}

/** Like parseAmount but keeps full precision (share counts, interest rates) */
export function parseNumber(input: string | undefined | null, fallback = 0): number {
  const v = evaluate(input ?? '')
  return v === null ? fallback : v
}
