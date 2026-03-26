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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
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
     * Keyboard opens from the BOTTOM — by anchoring to the top the modal
     * stays fully visible above the keyboard.
     * Desktop (sm:): centered as before.
     */
    <div className="fixed inset-0 z-50 flex flex-col justify-start pt-4 sm:justify-center sm:pt-0 sm:p-4 items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={`
          animate-scale-in
          relative w-full ${sizeClass}
          bg-gray-900 border border-gray-700 shadow-2xl
          rounded-2xl
          flex flex-col
          max-h-[82dvh] sm:max-h-[90vh]
        `}
      >
        {/* Sticky header — always visible */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content — this is the area that scrolls to reveal Save */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  )
}
