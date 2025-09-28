import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-white/10 bg-white/10 text-white',
        success: 'border-green-500/30 bg-green-500/20 text-green-300',
        warning: 'border-yellow-400/30 bg-yellow-400/20 text-yellow-100',
        danger: 'border-red-500/30 bg-red-500/20 text-red-200',
        info: 'border-blue-500/30 bg-blue-500/20 text-blue-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
