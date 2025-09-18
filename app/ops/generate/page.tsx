// app/ops/generate/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function Generate() {
  async function action() {
    'use server'
    const sb = supabaseServer()
    const today = new Date()
    const iso = today.toISOString().slice(0, 10)
    const weekday = ((today.getDay() + 6) % 7) + 1

    const { data: schedules, error } = await sb
      .from('schedule')
      .select('id, property_id, out_weekdays, in_weekdays')

    if (error) {
      console.error('Error fetching schedules:', error.message)
      return
    }

    for (const s of schedules || []) {
      if ((s.out_weekdays || []).includes(weekday)) {
        await sb
          .from('job')
          .insert({ property_id: s.property_id, kind: 'OUT', scheduled_for: iso })
          .select()
      }
      if ((s.in_weekdays || []).includes(weekday)) {
        await sb
          .from('job')
          .insert({ property_id: s.property_id, kind: 'IN', scheduled_for: iso })
          .select()
      }
    }
  }

  return (
    <div className="container">
      <BackButton />
      <h3 className="text-xl font-semibold mb-4">Generate Today&apos;s Jobs</h3>
      <form action={action}>
        <button className="btn" type="submit">
          Generate
        </button>
      </form>
    </div>
  )
}
