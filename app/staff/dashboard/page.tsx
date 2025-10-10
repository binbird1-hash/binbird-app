import { supabaseServer } from '@/lib/supabaseServer'

async function getStaffGreeting() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 'Welcome back'
  }

  const { data: profile } = await supabase
    .from('user_profile')
    .select('full_name, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const name = profile?.full_name ?? user.email ?? 'BinBird team member'

  return `Welcome back, ${name}`
}

export default async function StaffDashboardPage() {
  const greeting = await getStaffGreeting()

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">Staff dashboard</p>
        <h1 className="text-3xl font-semibold text-white">{greeting}</h1>
        <p className="text-sm text-white/60">
          Use the navigation to move between runs, routes, and daily schedules. This home view will grow with key metrics soon.
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
        <h2 className="text-lg font-semibold text-white">Quick links</h2>
        <ul className="mt-4 grid gap-3 text-sm">
          <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            Check today&apos;s runs in the <a className="font-semibold text-binbird-red hover:underline" href="/staff/run">Run planner</a>.
          </li>
          <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            Review route details inside <a className="font-semibold text-binbird-red hover:underline" href="/staff/route">Route manager</a>.
          </li>
          <li className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            Need to view proof? Visit the <a className="font-semibold text-binbird-red hover:underline" href="/staff/proof">Proof gallery</a>.
          </li>
        </ul>
      </div>
    </section>
  )
}
