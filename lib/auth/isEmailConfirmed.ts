import type { User } from "@supabase/supabase-js";

export function isEmailConfirmed(user: Pick<User, "email_confirmed_at" | "confirmed_at"> | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return Boolean(user.email_confirmed_at ?? user.confirmed_at ?? null);
}
