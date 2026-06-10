import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'lazada' | 'shopee' | 'store'
  className?: string
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  lazada: 'bg-orange-100 text-orange-700',
  shopee: 'bg-red-100 text-red-700',
  store: 'bg-blue-100 text-blue-700',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', variantClasses[variant], className)}>
      {children}
    </span>
  )
}
