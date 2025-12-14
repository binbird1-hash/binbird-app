import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function supabaseServer() {
  // Pass a fresh cookie snapshot per request; this ensures Supabase reads auth
  // cookies without attempting to mutate the server component response.
  return createServerComponentClient({ cookies: () => cookies() });
}
