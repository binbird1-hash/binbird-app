import type { User } from "@supabase/supabase-js";

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

function extractPortalRole(metadata: Record<string, unknown> | undefined): PortalRole {
  if (!metadata) return null;

  const possibleRoleKeys = ["role", "portal_role", "portalRole"] as const;

  for (const key of possibleRoleKeys) {
    const normalized = normalizePortalRole(metadata[key]);
    if (normalized) return normalized;
  }

  return null;
}

export function resolvePortalRoleFromUser(user: Pick<User, "app_metadata" | "user_metadata"> | null): PortalRole {
  if (!user) return null;

  const metadataRole = extractPortalRole(user.user_metadata) || extractPortalRole(user.app_metadata);

  return metadataRole;
}
