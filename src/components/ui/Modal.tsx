import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // iOS-safe scroll lock.
  // `overflow: hidden` on <body> is ignored by iOS Safari — the page still
  // scrolls behind the modal. Fix the body at the current scroll offset and
  // restore it on close.
  useEffect(() => {
    if (!open) return
    const scrollY = window.scrollY
    const body = document.body
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflowY = 'scroll'
    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflowY = ''
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior })
    }
  }, [open])

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[size]

  /*
   * Render into document.body via a portal so the modal is never clipped or
   * offset by an overflow / transform ancestor (e.g. the <main overflow-y-auto>
   * scroll container that wraps all tab content).  position:fixed is still used
   * inside the portal so keyboard-avoidance and safe-area insets work normally.
   *
   * Centered overlay on both mobile and desktop — sits in the middle of the
   * visible screen. mx-4 on the panel provides edge margins on mobile;
   * max-w-* on the panel caps width on desktop.
   */
  return createPortal(
    /* z-[200] sits above the bottom nav (z-50) and quick-add FAB (z-40) on all devices */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 cursor-pointer"
      onClick={onClose}
    >
      {/* Panel — stopPropagation so clicks inside don't close the modal */}
      <div
        onClick={e => e.stopPropagation()}
        className={`
          animate-scale-in cursor-default
          relative w-full mx-4 ${sizeClass}
          bg-gray-900 border border-gray-700/80 shadow-2xl shadow-black/60
          rounded-2xl ring-1 ring-white/5
          flex flex-col overscroll-contain
          max-h-[85vh]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0 gap-3 min-w-0">
          <h2 className="text-lg font-semibold text-white truncate min-w-0">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-6"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {children}
        </div>

        {/* Sticky footer — always visible, never scrolls away */}
        {footer && (
          <div className="shrink-0 border-t border-gray-700/60 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
