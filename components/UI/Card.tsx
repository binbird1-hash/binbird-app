'use client'

import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

export default function Card({
  title,
  icon: Icon,
  href,
  onClick
}: {
  title: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
}) {
  const content = (
    <div className="job cursor-pointer flex items-center justify-center gap-3 p-4 rounded-lg shadow bg-white text-black">
      <Icon className="w-6 h-6" />
      <span className="font-bold">{title}</span>
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return <div onClick={onClick}>{content}</div>
}
