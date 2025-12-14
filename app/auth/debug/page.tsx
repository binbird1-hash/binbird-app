import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePortalRole, resolvePortalRoleFromUser } from "@/lib/portalRoles";
import { supabaseServer } from "@/lib/supabaseServer";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <span className="text-sm text-slate-100">{value ?? "–"}</span>
    </div>
  );
}

export default async function AuthDebugPage() {
  const cookieStore = await cookies();
  const supabase = await supabaseServer();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const user = session.user;
  const metadataRole = resolvePortalRoleFromUser(user);
  const emailConfirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null;

  const { data: rpcRole, error: rpcError } = await supabase.rpc("get_my_role");

  const {
    data: profile,
    error: profileError,
  } = await supabase.from("user_profile").select("role, full_name").eq("user_id", user.id).maybeSingle();

  const normalizedRole = normalizePortalRole(metadataRole ?? rpcRole ?? profile?.role ?? null);
  const cookieKeys = cookieStore.getAll().map((c) => c.name).join(", ");

  const highlights: Array<{ label: string; value: string | null }> = [
    { label: "User ID", value: user.id },
    { label: "Email", value: user.email ?? null },
    { label: "Email confirmed at", value: emailConfirmedAt },
    { label: "User metadata role", value: metadataRole },
    { label: "RPC get_my_role", value: rpcRole ?? null },
    { label: "RPC error", value: rpcError?.message ?? null },
    { label: "Profile role", value: profile?.role ?? null },
    { label: "Profile name", value: profile?.full_name ?? null },
    { label: "Normalized role", value: normalizedRole },
    { label: "Cookies present", value: cookieKeys || null },
    { label: "Last sign in", value: user.last_sign_in_at },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-slate-950 px-4 py-10 text-slate-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Troubleshooting</p>
          <h1 className="text-3xl font-bold text-white">Auth debug</h1>
          <p className="mt-2 text-sm text-slate-300">
            Use this page to see what the server knows about your session, profile role, and cookies when
            attempting to access admin. Share these values (redacting anything sensitive) to pinpoint whether
            the failure is happening in the middleware, Supabase role data, or Vercel deployment config.
          </p>
        </div>
        <a
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800"
          href="/auth/login"
        >
          Back to login
        </a>
      </div>

      <div className="space-y-3">
        {highlights.map((item) => (
          <DetailRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
        <p className="font-semibold text-amber-200">Next steps when admin is blocked</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Confirm you see a Supabase session cookie above (usually named <code>sb</code> and <code>sb-refresh</code>)
            and that the session <strong>User ID</strong> matches your profile row.
          </li>
          <li>
            If <strong>RPC get_my_role</strong> or <strong>Profile role</strong> shows <code>null</code>, verify the
            <code>user_profile</code> table has your <code>user_id</code> with <code>role = 'admin'</code> and that the
            <code>get_my_role</code> function returns the role column.
          </li>
          <li>
            If the <strong>Normalized role</strong> is still empty, check Vercel environment variables for Supabase URL
            and keys, redeploy, then sign out/in so middleware can refresh the session cookies.
          </li>
        </ol>
      </div>
    </div>
  );
}
