export type PortalRole = 'admin' | 'staff' | 'client' | null

const ADMIN_ROLES = new Set(['admin', 'ops', 'operations'])
const STAFF_ROLES = new Set(['staff', 'team'])
const CLIENT_ROLES = new Set(['client', 'customer'])

const ROLE_PRIORITY: Record<Exclude<PortalRole, null>, number> = {
  admin: 3,
  staff: 2,
  client: 1,
}

export function resolveHighestPriorityRole(...roles: PortalRole[]): PortalRole {
  let resolvedRole: PortalRole = null

  for (const role of roles) {
    if (!role) continue
    const currentPriority = resolvedRole ? ROLE_PRIORITY[resolvedRole] : 0

    if (!resolvedRole || ROLE_PRIORITY[role] > currentPriority) {
      resolvedRole = role
    }
  }

  return resolvedRole
}

export function normalizePortalRole(role: unknown): PortalRole {
  if (Array.isArray(role)) {
    const normalizedRoles = role
      .map((value) => normalizePortalRole(value))
      .filter((value): value is Exclude<PortalRole, null> => value !== null)

    return resolveHighestPriorityRole(...normalizedRoles)
  }

  if (typeof role !== 'string') return null

  const normalized = role.trim().toLowerCase()
  if (!normalized) return null

  if (ADMIN_ROLES.has(normalized)) return 'admin'
  if (STAFF_ROLES.has(normalized)) return 'staff'
  if (CLIENT_ROLES.has(normalized)) return 'client'

  return null
}

export function resolveRoleFromMetadata(metadata: unknown): PortalRole {
  if (!metadata || typeof metadata !== 'object') return null

  const values = Array.isArray(metadata) ? metadata : Object.values(metadata)
  const candidates: PortalRole[] = []

  for (const value of values) {
    const normalized = normalizePortalRole(value)
    if (normalized) {
      candidates.push(normalized)
    }
  }

  return resolveHighestPriorityRole(...candidates)
}
