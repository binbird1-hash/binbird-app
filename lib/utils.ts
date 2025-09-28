import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseLatLng(value: string | null | undefined) {
  if (!value) return null
  const [lat, lng] = value.split(',').map((part) => Number.parseFloat(part.trim()))
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }
  return null
}

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

export function getNextDayOfWeek(dayName: string, from = new Date()) {
  const normalized = dayName.toLowerCase()
  const targetIndex = DAY_NAMES.indexOf(normalized)
  if (targetIndex === -1) return null
  const result = new Date(from)
  const currentIndex = result.getDay()
  let diff = targetIndex - currentIndex
  if (diff <= 0) {
    diff += 7
  }
  result.setDate(result.getDate() + diff)
  return result
}

export function formatCurrency(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return '$0.00'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2,
  }).format(value)
}
