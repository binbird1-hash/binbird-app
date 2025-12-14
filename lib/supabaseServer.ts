import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();

  // Provide a defensive cookie adapter so the auth helper always receives a
  // `get` function, even though Next.js now exposes cookies asynchronously.
  return createServerComponentClient({
    cookies: () =>
      ({
        get: (name: string) => {
          const cookie = cookieStore?.get?.(name);
          if (!cookie) return void 0;
          return typeof cookie === "string" ? { name, value: cookie } : cookie;
        },
      } as unknown as ReturnType<typeof cookies>),
  });
}
