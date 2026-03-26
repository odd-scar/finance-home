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
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ${onClick ? 'cursor-pointer hover:border-gray-600 transition-colors' : ''} ${className}`}
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
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className={`text-sm mt-1 ${subColor}`}>{sub}</p>}
        </div>
        {icon && (
          <div className={`p-3 rounded-xl ${iconBg}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
