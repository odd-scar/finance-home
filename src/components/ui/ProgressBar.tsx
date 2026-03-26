interface ProgressBarProps {
  value: number
  max: number
  color?: string
  height?: string
  showLabel?: boolean
}

export function ProgressBar({ value, max, color = 'bg-brand-500', height = 'h-2', showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full">
      <div className={`w-full ${height} bg-gray-800 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-400 mt-1 text-right">{pct.toFixed(0)}%</p>
      )}
    </div>
  )
}
