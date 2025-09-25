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
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-16 text-slate-50">
      <div className="w-full max-w-4xl space-y-8 text-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">BinBird</p>
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl">Choose your workspace</h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Head to the client portal to review services and communicate with the team, or open the staff portal to coordinate
            today&apos;s runs.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {portals.map((portal) => (
            <Link
              key={portal.href}
              href={portal.href}
              className="group flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-left transition hover:border-slate-500 hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-slate-50">{portal.title}</h2>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-300 transition group-hover:border-slate-500 group-hover:text-slate-200">
                  Enter
                </span>
              </div>
              <p className="text-sm text-slate-300 sm:text-base">{portal.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
