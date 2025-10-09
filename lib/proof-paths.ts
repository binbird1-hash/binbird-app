export function toKebab(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback
  return value
    .toLowerCase()
    .replace(/,\s*/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function getCustomWeek(date: Date) {
  const base = new Date(date.valueOf())
  const d = Number.isNaN(base.getTime()) ? new Date() : base

  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1)
  }

  const target = new Date(d.valueOf())
  const dayNr = (target.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.valueOf() - firstThursday.valueOf()
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000))

  return {
    year: target.getFullYear(),
    week: `Week-${week}`,
  }
}

const PUBLIC_PROOFS_PREFIX = /https?:\/\/[^/]+\/storage\/v1\/object\/public\/proofs\//i

export function normaliseProofFilePath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null
  const trimmed = path.trim()
  if (!trimmed) return null

  const cleaned = trimmed
    .replace(PUBLIC_PROOFS_PREFIX, "")
    .replace(/^proofs\//i, "")
    .replace(/^\/+/, "")

  if (!cleaned) return null

  if (!/\.[a-z0-9]+$/i.test(cleaned)) {
    return null
  }

  return cleaned
}

function normaliseTaskType(value: string | null | undefined): "bring_in" | "put_out" {
  if (!value) return "put_out"
  const normalised = value.toLowerCase().replace(/[^a-z]/g, " ")
  if (normalised.includes("bring")) {
    return "bring_in"
  }
  return "put_out"
}

function parseLogDate(doneOn: string | null | undefined, createdAt: string | null | undefined): Date | null {
  const candidate = doneOn ?? createdAt
  if (!candidate) return null
  const parsed = new Date(candidate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export type ProofLikeLog = {
  id?: string | number | null
  photo_path?: string | null
  client_name?: string | null
  address?: string | null
  task_type?: string | null
  job_type?: string | null
  done_on?: string | null
  created_at?: string | null
}

export function deriveProofPathFromLog(log: ProofLikeLog): string | null {
  const existing = normaliseProofFilePath(log.photo_path ?? null)
  if (existing) {
    return existing
  }

  const completedAt = parseLogDate(log.done_on ?? null, log.created_at ?? null)
  if (!completedAt) {
    return null
  }

  const safeClient = toKebab(log.client_name ?? null, "unknown-client")
  const safeAddress = toKebab(log.address ?? null, "unknown-address")
  const { year, week } = getCustomWeek(completedAt)
  const taskType = normaliseTaskType(log.task_type ?? log.job_type ?? null)
  const fileName = taskType === "bring_in" ? "Bring In.jpg" : "Put Out.jpg"

  return `${safeClient}/${safeAddress}/${year}/${week}/${fileName}`
}
