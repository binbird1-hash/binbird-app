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
