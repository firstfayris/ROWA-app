import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'pink' | 'green' | 'orange'
  className?: string
}

const colorMap = {
  blue: { bg: 'bg-rowa-blue/10', icon: 'text-rowa-blue', border: 'border-rowa-blue/20' },
  pink: { bg: 'bg-rowa-pink/10', icon: 'text-rowa-pink', border: 'border-rowa-pink/20' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue', className }: StatCardProps) {
  const colors = colorMap[color]
  return (
    <div className={cn('card flex items-start gap-4', className)}>
      <div className={cn('p-3 rounded-xl', colors.bg)}>
        <Icon className={cn('h-6 w-6', colors.icon)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-rowa-muted">{title}</p>
        <p className="text-2xl font-bold text-rowa-text mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-rowa-muted mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={cn('text-xs font-medium mt-1', trend.value >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  )
}
