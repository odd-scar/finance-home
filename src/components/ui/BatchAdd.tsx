import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '../../utils/finance'

export interface AddedItem { id: string; label: string; amount: number | null }

/**
 * "Keep adding" forms: after Save the form stays open and clears for the next
 * entry, and this tracks what was added in the current session so the user can
 * see it worked — they close with Done when finished.
 */
export function useBatchAdd() {
  const [added, setAdded] = useState<AddedItem[]>([])
  // Bump to remount the form so its first field gets focus again
  const [formKey, setFormKey] = useState(0)
  return {
    added,
    formKey,
    record: (item: AddedItem) => { setAdded(a => [...a, item]); setFormKey(k => k + 1) },
    reset: () => { setAdded([]); setFormKey(k => k + 1) },
  }
}

/** Shows the last few items added in this session, with a running count and total */
export function JustAdded({ items, noun = 'item' }: { items: AddedItem[]; noun?: string }) {
  if (items.length === 0) return null
  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0)
  const last = items.slice(-3).reverse()
  return (
    <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2.5">
      <div className="flex items-center justify-between text-xs text-emerald-300 font-medium mb-1.5">
        <span>{items.length} {noun}{items.length === 1 ? '' : 's'} added</span>
        {total > 0 && <span>{formatCurrency(total)}</span>}
      </div>
      <ul className="space-y-1">
        {last.map(i => (
          <li key={i.id} className="flex items-center gap-2 text-sm text-gray-200 animate-fade-in">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate flex-1">{i.label}</span>
            {i.amount !== null && <span className="text-gray-400 shrink-0">{formatCurrency(i.amount)}</span>}
          </li>
        ))}
      </ul>
      {items.length > 3 && <p className="text-[11px] text-gray-500 mt-1">+{items.length - 3} earlier</p>}
    </div>
  )
}
