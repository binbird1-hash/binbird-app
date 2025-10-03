export type BinLabel = 'Garbage' | 'Recycling' | 'Compost'

const BIN_KEYWORDS: { label: BinLabel; keywords: string[] }[] = [
  { label: 'Garbage', keywords: ['garbage', 'landfill', 'general', 'trash', 'rubbish', 'red'] },
  { label: 'Recycling', keywords: ['recycling', 'commingled', 'co-mingled', 'yellow'] },
  { label: 'Compost', keywords: ['compost', 'organic', 'food', 'green'] },
]

const titleCase = (value: string): string => value.replace(/\b\w/g, (match) => match.toUpperCase())

export function formatBinLabel(rawValue: string): string | null {
  if (typeof rawValue !== 'string') return null
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  for (const { label, keywords } of BIN_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return label
    }
  }
  return titleCase(trimmed)
}

export function normaliseBinList(value: unknown): string[] {
  if (!value) return []
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const normalised = items
    .map((item) => formatBinLabel(String(item)))
    .filter((item): item is string => Boolean(item))
  return Array.from(new Set(normalised))
}
