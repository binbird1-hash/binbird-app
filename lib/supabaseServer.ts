import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export function supabaseServer() {
  // Provide the request-scoped cookie reader expected by App Router helpers so
  // server components can resolve auth state without attempting to write.
  return createServerComponentClient<Database>({ cookies });
}
