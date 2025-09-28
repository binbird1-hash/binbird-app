'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'

export async function generateJobsAction() {
  const { supabase } = await requireAuth('admin')
  await supabase.rpc('refresh_jobs')
  revalidatePath('/admin')
}
