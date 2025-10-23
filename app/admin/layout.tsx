import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminSidebar, { type AdminNavItem } from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";
import { normalizePortalRole } from "@/lib/portalRoles";
import { supabaseServer } from "@/lib/supabaseServer";

async function resolveAdminContext() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileRole = normalizePortalRole(profile?.role);

  if (profileRole !== "admin") {
    redirect("/");
  }

  const displayName = profile?.full_name?.trim().length
    ? profile.full_name
    : user.email ?? "Admin";

  const navItems: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/property-requests", label: "Property Requests" },
    { href: "/admin/clients", label: "Client List" },
    { href: "/admin/clients/new", label: "Add Property" },
    { href: "/admin/jobs", label: "Jobs" },
    { href: "/admin/logs", label: "Logs & Proofs" },
    { href: "/admin/tokens", label: "Client Tokens" },
  ];

  return {
    userEmail: user.email ?? "",
    displayName,
    navItems,
  };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { displayName, userEmail, navItems } = await resolveAdminContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <AdminSidebar items={navItems} userName={displayName} userEmail={userEmail} />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-800 bg-slate-950/90 px-4 py-4 shadow-sm lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">BinBird</p>
                <p className="text-lg font-semibold text-white">Admin Control</p>
              </div>
              <div className="w-32">
                <AdminSignOutButton />
              </div>
            </div>
          </header>
          <div className="border-b border-slate-900 bg-slate-950/80 px-4 py-2 lg:hidden">
            <AdminMobileNav items={navItems} />
          </div>
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
