import Image from 'next/image'
import wingIcon from '@/public/wing-favicon.png'

export default function Header({ title }: { title: string }) {
  return (
    <header className="mb-6 flex flex-col items-center">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-full bg-white/90 p-2 shadow-sm ring-1 ring-black/10">
          <Image
            src={wingIcon}
            alt="BinBird wing"
            className="h-8 w-8"
            priority
          />
        </div>
        <h1 className="text-3xl font-bold text-[var(--accent)]">{title}</h1>
      </div>
    </header>
  )
}
