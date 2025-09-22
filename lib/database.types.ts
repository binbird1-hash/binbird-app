// lib/database.types.ts

export type Property = {
  id: number
  address: string
  notes?: string | null
}

export type Client = {
  id: number
  name: string
  properties: Property[]
}

export type ClientTokenRow = {
  token: string
  client: Client[]
}

export type JobRecord = {
  id: string
  address: string | null
  lat: number | null
  lng: number | null
  last_completed_on: string | null
  assigned_to: string | null
  day_of_week: string | null
  photo_path: string | null
  client_name: string | null
  bins: string | null
  notes: string | null
  job_type: string | null
}
