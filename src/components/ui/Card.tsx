import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ${onClick ? 'cursor-pointer hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  icon?: React.ReactNode
  iconBg?: string
}

export function StatCard({ label, value, sub, subColor = 'text-gray-400', icon, iconBg = 'bg-brand-600/20' }: StatCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 rounded-2xl p-4 sm:p-5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
          {sub && <p className={`text-xs sm:text-sm mt-1 ${subColor}`}>{sub}</p>}
        </div>
        {/* Icon is decoration — hidden on phones so the numbers get the room */}
        {icon && (
          <div className={`hidden sm:block p-3 rounded-xl shrink-0 ${iconBg}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
