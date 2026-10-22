import { useEffect, useRef, useState } from 'react'
import { evaluate, isExpression } from '../../lib/mathExpr'
import { formatCurrency } from '../../lib/finance'

interface MoneyInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Shown before the number (default "$"); pass "" for plain numbers like shares or % */
  prefix?: string
  /** Show the result as money (default) or as a plain number */
  money?: boolean
  autoFocus?: boolean
  onEnter?: () => void
  'aria-label'?: string
  /** Extra classes for the <input> (e.g. bigger text) */
  className?: string
  /** Lets the parent focus the field (e.g. after logging an entry) */
  inputRef?: React.RefObject<HTMLInputElement>
}

const KEYS: { label: string; insert: string }[] = [
  { label: '+', insert: '+' },
  { label: '−', insert: '-' },
  { label: '×', insert: '*' },
  { label: '÷', insert: '/' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
]

/**
 * Amount field with a built-in calculator: type "450+380" and it shows "= $830.00",
 * then turns into 830 when you leave the field. Phones get a + − × ÷ row while
 * typing, since their number keypads have no operator keys.
 */
export function MoneyInput({
  value, onChange, placeholder = '0.00', prefix = '$', money = true, autoFocus, onEnter, className = '', inputRef, ...rest
}: MoneyInputProps) {
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef
  const [focused, setFocused] = useState(false)
  const isCalc = isExpression(value)
  const result = isCalc ? evaluate(value) : null
  const fmt = (n: number) => (money ? formatCurrency(n) : String(Math.round(n * 10000) / 10000))

  // Latest value, so a delayed commit never writes back an old calculation
  // (e.g. after the form was cleared for the next entry)
  const valueRef = useRef(value)
  valueRef.current = value
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Replace a finished calculation with its result
  const commit = () => {
    const current = valueRef.current
    if (!isExpression(current)) return
    const v = evaluate(current)
    if (v !== null) onChange(String(Math.round(v * (money ? 100 : 10000)) / (money ? 100 : 10000)))
  }

  // Leaving the field hides the operator row and the "= …" line. Doing that instantly
  // shifts the layout mid-tap, so a tap on a button below (e.g. "Add") lands on empty
  // space. Wait a moment so the tap completes first. (Saving never depends on this —
  // forms read amounts with parseAmount, which evaluates the calculation itself.)
  const handleBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => { setFocused(false); commit() }, 250)
  }
  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setFocused(true)
  }
  // If the field is removed (e.g. the form resets for the next entry), drop the
  // pending commit — otherwise it would write the old result into the fresh form
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current) }, [])

  const insert = (s: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + s + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + s.length, start + s.length)
    })
  }

  return (
    <div>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ fontSize: 'inherit' }}>{prefix}</span>}
        <input
          ref={ref}
          type="text"
          // Decimal keypad on phones; the operator row below supplies + − × ÷
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit(); onEnter?.() }
            if (e.key === '=') { e.preventDefault(); commit() }
          }}
          aria-label={rest['aria-label']}
          className={`w-full bg-gray-800 border ${isCalc && result === null ? 'border-amber-500/60' : 'border-gray-700'} rounded-lg ${prefix ? 'pl-7' : 'pl-3'} pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base ${className}`}
        />
      </div>
      {isCalc && (
        <p className={`text-xs mt-1 ${result === null ? 'text-amber-400' : 'text-brand-300'}`}>
          {result === null ? 'Keep typing — that calculation isn’t complete yet' : `= ${fmt(result)}`}
        </p>
      )}
      {focused && (
        <div className="flex gap-1.5 mt-1.5 sm:hidden">
          {KEYS.map(k => (
            <button
              key={k.label}
              type="button"
              // preventDefault on pointer-down keeps the keyboard open and the field focused
              onPointerDown={e => { e.preventDefault(); insert(k.insert) }}
              className="flex-1 h-9 rounded-lg bg-gray-700 active:bg-gray-600 text-white text-base font-medium"
            >
              {k.label}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={e => { e.preventDefault(); commit() }}
            className="flex-1 h-9 rounded-lg bg-brand-600 active:bg-brand-500 text-white text-base font-semibold"
          >
            =
          </button>
        </div>
      )}
    </div>
  )
}
