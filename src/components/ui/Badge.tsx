interface BadgeProps {
  children: React.ReactNode
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'
}

const colors = {
  green: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-rose-500/15 text-rose-400',
  yellow: 'bg-amber-500/15 text-amber-400',
  blue: 'bg-sky-500/15 text-sky-400',
  purple: 'bg-brand-500/15 text-brand-400',
  gray: 'bg-gray-700 text-gray-300',
}

export function Badge({ children, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
