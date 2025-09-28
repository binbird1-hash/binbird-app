import type { Tables } from '@/lib/database.types'

export type ClientProperty = Tables<'client_list'> & {
  assigned_staff?: Pick<Tables<'user_profile'>, 'user_id' | 'full_name'> | null
  coordinates?: { lat: number; lng: number } | null
}

export type ClientLog = Tables<'logs'>

export type ClientJob = Tables<'jobs'> & {
  status: 'pending' | 'on_the_way' | 'arrived' | 'done'
  logs: ClientLog[]
}

export type ClientPortalData = {
  profile: Tables<'user_profile'>
  properties: ClientProperty[]
  jobs: ClientJob[]
  logs: ClientLog[]
}
