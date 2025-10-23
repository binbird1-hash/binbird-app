export type PortalRole = "staff" | "client" | "admin" | null;

export function normalizePortalRole(role: unknown): PortalRole {
  if (typeof role !== "string") {
    return null;
  }

  const normalized = role.trim().toLowerCase();

  if (normalized === "admin" || normalized === "staff" || normalized === "client") {
    return normalized;
  }

  return null;
}
