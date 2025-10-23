'use client'

import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

type CardProps = {
  title: string
  description?: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
}

export default function Card({ title, description, icon: Icon, href, onClick }: CardProps) {
  const content = (
    <div className="job group w-full cursor-pointer rounded-lg bg-white p-4 text-left text-black shadow transition hover:shadow-lg">
      <div className="flex gap-3">
        <Icon className="h-6 w-6 flex-shrink-0 text-binbird-red" />
        <div className="flex flex-col gap-1">
          <span className="font-bold leading-tight">{title}</span>
          {description && <span className="text-sm text-black/60">{description}</span>}
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-binbird-red"
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={onClick ? 'block focus-visible:outline focus-visible:outline-2 focus-visible:outline-binbird-red' : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      {content}
    </div>
  )
}
