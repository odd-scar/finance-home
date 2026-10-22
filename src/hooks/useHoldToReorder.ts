import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

/** How long to hold before an item picks up */
const HOLD_MS = 350
/** Moving further than this before the hold finishes means the user is scrolling */
const MOVE_TOLERANCE = 8

interface Drag { id: string; from: number; to: number; dx: number; dy: number }

/**
 * Press and hold an item, then drag it to a new spot (touch or mouse). The other items
 * slide out of the way while dragging; letting go calls `onDrop(id, targetId)`.
 * Works for lists and grids: the drop spot is whichever slot is closest to the item.
 *
 * Spread `itemProps(id)` on each item. Items must be direct children of the same parent.
 * A quick tap still clicks; a swipe still scrolls.
 */
export function useHoldToReorder(ids: string[], onDrop: (id: string, targetId: string) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  /** Each item's box when the drag started, in the same order as `ids` */
  const slots = useRef<DOMRect[]>([])
  const endSession = useRef<(() => void) | null>(null)
  /** Swallows the click that the browser fires right after a drop */
  const justDropped = useRef(false)

  useEffect(() => () => endSession.current?.(), [])

  const onPointerDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || ids.length < 2 || endSession.current) return
    // Buttons inside the item (edit, delete…) keep working normally
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return

    const item = e.currentTarget
    const startX = e.clientX, startY = e.clientY
    let active = false, from = -1, to = -1

    const timer = setTimeout(() => {
      const siblings = Array.from(item.parentElement?.children ?? [])
        .filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.reorderId)
      from = siblings.indexOf(item)
      if (from < 0) return end()
      slots.current = siblings.map(el => el.getBoundingClientRect())
      to = from
      active = true
      navigator.vibrate?.(15)
      setDrag({ id, from, to, dx: 0, dy: 0 })
    }, HOLD_MS)

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (!active) {
        if (Math.hypot(dx, dy) > MOVE_TOLERANCE) end()
        return
      }
      const start = slots.current[from]
      const cx = start.left + start.width / 2 + dx, cy = start.top + start.height / 2 + dy
      let best = from, bestDist = Infinity
      slots.current.forEach((r, i) => {
        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
        if (d < bestDist) { bestDist = d; best = i }
      })
      to = best
      setDrag({ id, from, to, dx, dy })
    }
    const up = () => {
      if (active) {
        justDropped.current = true
        setTimeout(() => { justDropped.current = false }, 0)
        if (to !== from && ids[to]) onDrop(id, ids[to])
      }
      end()
    }
    // While dragging, the finger moves the item instead of scrolling the page
    const blockScroll = (ev: TouchEvent) => { if (active) ev.preventDefault() }
    // Long-press would otherwise open the phone's copy/share menu
    const blockMenu = (ev: Event) => ev.preventDefault()

    function end() {
      clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('touchmove', blockScroll)
      item.removeEventListener('contextmenu', blockMenu)
      endSession.current = null
      setDrag(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', end)
    window.addEventListener('touchmove', blockScroll, { passive: false })
    item.addEventListener('contextmenu', blockMenu)
    endSession.current = end
  }

  const style = (id: string): CSSProperties => {
    const base: CSSProperties = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }
    if (!drag) return base
    if (id === drag.id) {
      return {
        ...base,
        transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.02)`,
        position: 'relative',
        zIndex: 20,
        backgroundColor: '#1f2937',
        boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
        cursor: 'grabbing',
      }
    }
    // Items between the start and the drop spot slide one slot toward the start
    const k = ids.indexOf(id)
    let slot = k
    if (drag.from < drag.to && k > drag.from && k <= drag.to) slot = k - 1
    else if (drag.to < drag.from && k >= drag.to && k < drag.from) slot = k + 1
    const here = slots.current[k], there = slots.current[slot]
    if (!here || !there) return base
    return {
      ...base,
      transform: `translate(${there.left - here.left}px, ${there.top - here.top}px)`,
      transition: 'transform 150ms ease',
    }
  }

  const itemProps = (id: string) => ({
    'data-reorder-id': id,
    onPointerDown: onPointerDown(id),
    onClickCapture: (e: ReactMouseEvent) => {
      if (justDropped.current) { e.stopPropagation(); e.preventDefault() }
    },
    style: style(id),
  })

  return { itemProps, dragging: drag !== null }
}
