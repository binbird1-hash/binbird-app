export type ClientListRow = {
  property_id: string
  account_id: string | null
  client_name: string | null
  company: string | null
  address: string | null
  collection_day: string | null
  put_bins_out: string | null
  notes: string | null
  red_freq: string | null
  red_flip: string | null
  red_bins: number | string | null
  yellow_freq: string | null
  yellow_flip: string | null
  yellow_bins: number | string | null
  green_freq: string | null
  green_flip: string | null
  green_bins: number | string | null
  email: string | null
  assigned_to: string | null
  lat_lng: string | null
  price_per_month: number | null
  photo_path: string | null
  trial_start: string | null
  membership_start: string | null
}

export type ClientFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "assignee"
  | "bin-frequency"
  | "flip"

export type ClientFieldConfig = {
  key: keyof ClientListRow
  label: string
  type?: ClientFieldType
}

export const CLIENT_FIELD_CONFIGS: ClientFieldConfig[] = [
  { key: "property_id", label: "Property ID" },
  { key: "account_id", label: "Account ID" },
  { key: "client_name", label: "Client Name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "lat_lng", label: "Lat/Lng" },
  { key: "collection_day", label: "Collection Day" },
  { key: "put_bins_out", label: "Put Bins Out" },
  { key: "assigned_to", label: "Assigned To", type: "assignee" },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "red_freq", label: "Red Bin Frequency", type: "bin-frequency" },
  { key: "red_flip", label: "Red Flip", type: "flip" },
  { key: "red_bins", label: "Red Bins", type: "number" },
  { key: "yellow_freq", label: "Yellow Bin Frequency", type: "bin-frequency" },
  { key: "yellow_flip", label: "Yellow Flip", type: "flip" },
  { key: "yellow_bins", label: "Yellow Bins", type: "number" },
  { key: "green_freq", label: "Green Bin Frequency", type: "bin-frequency" },
  { key: "green_flip", label: "Green Flip", type: "flip" },
  { key: "green_bins", label: "Green Bins", type: "number" },
  { key: "photo_path", label: "Photo Path" },
  { key: "price_per_month", label: "Price Per Month", type: "number" },
  { key: "trial_start", label: "Trial Start", type: "date" },
  { key: "membership_start", label: "Membership Start", type: "date" },
]

export const CLIENT_NUMBER_FIELD_KEYS: Array<keyof ClientListRow> = [
  "red_bins",
  "yellow_bins",
  "green_bins",
  "price_per_month",
]

export const CLIENT_DATE_FIELD_KEYS: Array<keyof ClientListRow> = [
  "trial_start",
  "membership_start",
]
