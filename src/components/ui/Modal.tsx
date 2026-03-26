import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // iOS-safe scroll lock.
  // `overflow: hidden` on <body> is ignored by iOS Safari — the page still
  // scrolls behind the modal.  The correct fix is to fix the body in place at
  // the current scroll offset and restore it on close.
  useEffect(() => {
    if (!open) return

    const scrollY = window.scrollY
    const body = document.body

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    // Prevent width collapse caused by the scrollbar disappearing
    body.style.overflowY = 'scroll'

    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflowY = ''
      // Restore the scroll position silently
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior })
    }
  }, [open])

  if (!open) return null

  const sizeClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-2xl',
  }[size]

  return (
    /*
     * Mobile: flex column, anchored to TOP with pt-4 padding.
     * When the iOS keyboard opens it shrinks the visual viewport from the
     * bottom — anchoring to the top keeps the modal header always visible.
     * The scrollable content area lets the user scroll to reach lower fields.
     * Desktop (sm:): centered as usual.
     */
    <div className="fixed inset-0 z-50 flex flex-col justify-start pt-4 sm:justify-center sm:pt-0 sm:p-4 items-center">
      {/* Backdrop — pointer-events only on itself so the panel stays tappable */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div
        className={`
          animate-scale-in
          relative w-full ${sizeClass}
          bg-gray-900 border border-gray-700 shadow-2xl
          rounded-2xl
          flex flex-col
          max-h-[85dvh] sm:max-h-[90vh]
        `}
      >
        {/* Sticky header — always visible even when keyboard is open */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content — user can scroll to reach fields below keyboard */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-10"
          // iOS Safari needs this hint to enable momentum scrolling inside
          // fixed/overflow containers
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
