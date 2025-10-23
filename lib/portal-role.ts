export type PortalRole = "staff" | "client" | "admin";

export type PortalRoleOrNull = PortalRole | null;

const VALID_ROLES: PortalRole[] = ["staff", "client", "admin"];

export function normalizePortalRole(value: unknown): PortalRoleOrNull {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return VALID_ROLES.includes(normalized as PortalRole)
    ? (normalized as PortalRole)
    : null;
}
