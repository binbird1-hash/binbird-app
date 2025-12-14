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

export function resolvePortalRoleFromUser(user: Pick<User, "app_metadata" | "user_metadata"> | null): PortalRole {
  if (!user) return null;

  const userMetadataRole = normalizePortalRole(user.user_metadata?.role);
  if (userMetadataRole) return userMetadataRole;

  return normalizePortalRole(user.app_metadata?.role);
}
