import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export function supabaseServer() {
  const cookieStore = cookies();

  // Provide a defensive cookie adapter so the auth helper always receives a
  // `get` function, even if the underlying cookie implementation changes.
  return createServerComponentClient({
    cookies: () => ({
      get: (name: string) => {
        const cookie = cookieStore?.get?.(name);
        if (!cookie) return void 0;
        return typeof cookie === "string" ? { name, value: cookie } : cookie;
      },
    }),
  });
}
