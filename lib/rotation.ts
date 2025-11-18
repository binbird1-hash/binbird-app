export type RotationWeek = {
  year: number
  week: string
}

// Custom week helper (Monday-Saturday cycle, Sunday joins next week)
export function getRotationWeek(date: Date = new Date()): RotationWeek {
  const d = new Date(date)

  // If Sunday, push to Monday (next cycle)
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1)
  }

  const target = new Date(d.valueOf())
  const dayNr = (target.getDay() + 6) % 7 // Monday=0 … Sunday=6
  target.setDate(target.getDate() - dayNr + 3) // Thursday of current week
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.valueOf() - firstThursday.valueOf()
  const weekNumber = 1 + Math.round(diff / (7 * 24 * 3600 * 1000))

  return {
    year: target.getFullYear(),
    week: `Week-${weekNumber}`,
  }
}

export function getRotationWeekKey(date: Date = new Date()): string {
  const { year, week } = getRotationWeek(date)
  return `${year}-${week}`
}
