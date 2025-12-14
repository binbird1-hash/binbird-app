import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function supabaseServer() {
  // Use the App Router helper so Supabase can read auth cookies without trying to
  // write them inside a Server Component (which was causing the admin layout to hang).
  return createServerComponentClient({ cookies });
}
