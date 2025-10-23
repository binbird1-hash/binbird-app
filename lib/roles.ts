export type PortalRole = 'admin' | 'staff' | 'client' | null

const ADMIN_ROLES = new Set(['admin', 'ops', 'operations'])
const STAFF_ROLES = new Set(['staff', 'team'])
const CLIENT_ROLES = new Set(['client', 'customer'])

const ROLE_PRIORITY: Record<Exclude<PortalRole, null>, number> = {
  admin: 3,
  staff: 2,
  client: 1,
}

export function normalizePortalRole(role: unknown): PortalRole {
  if (typeof role !== 'string') return null

  const normalized = role.trim().toLowerCase()
  if (!normalized) return null

  if (ADMIN_ROLES.has(normalized)) return 'admin'
  if (STAFF_ROLES.has(normalized)) return 'staff'
  if (CLIENT_ROLES.has(normalized)) return 'client'

  return null
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
