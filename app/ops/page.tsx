// app/ops/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function Ops() {
  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return (
      <div className="container">
        <p>
          Please <a href="/auth/login">sign in</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">Ops Console</h2>
      <ul className="space-y-2">
        <li>
          <a href="/ops/generate">Generate Today&apos;s Jobs</a>
        </li>
        <li>
          <a href="/ops/tokens">Client Tokens</a>
        </li>
        <li>
          <a href="/ops/dashboard">Dashboard</a>
        </li>
      </ul>
    </div>
  )
}
