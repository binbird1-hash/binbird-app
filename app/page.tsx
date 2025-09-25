import Link from 'next/link'

const portals = [
  {
    href: '/client',
    title: 'Client Portal',
    description:
      'View invoices, monitor upcoming services, and browse proof galleries tailored to your properties.',
  },
  {
    href: '/staff',
    title: 'Staff Portal',
    description:
      'Manage runs, capture proof, and keep route preferences up to date while you are out in the field.',
  },
] as const

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-red-950 text-white">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,87,87,0.12),_transparent_55%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full space-y-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/60">BinBird Portals</p>
          <h1 className="text-3xl font-semibold sm:text-4xl md:text-5xl">Choose where you need to be</h1>
          <p className="text-base text-white/70 sm:text-lg">
            Jump into the client experience to review services and proofs, or open the staff workspace to coordinate today&apos;s
            runs.
          </p>
        </div>

        <div className="mt-10 grid w-full gap-6 md:grid-cols-2">
          {portals.map((portal) => (
            <Link
              key={portal.href}
              href={portal.href}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/40 backdrop-blur transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-full flex-col gap-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold text-white">{portal.title}</h2>
                  <span className="rounded-full border border-white/20 bg-black/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition group-hover:border-binbird-red/60 group-hover:text-white">
                    Enter
                  </span>
                </div>
                <p className="text-sm text-white/70 sm:text-base">{portal.description}</p>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-binbird-red transition group-hover:text-white">
                  Start now
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
