import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminSidebar, { type AdminNavItem } from "@/components/admin/AdminSidebar";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import AdminSignOutButton from "@/components/admin/AdminSignOutButton";
import { supabaseServer } from "@/lib/supabaseServer";

async function resolveAdminContext() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: role, error: roleError } = await supabase.rpc("get_my_role");

  if (roleError || role !== "admin") {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim().length
    ? profile.full_name
    : user.email ?? "Admin";

  const navItems: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/clients", label: "Property List" },
    { href: "/admin/jobs", label: "Jobs" },
    { href: "/admin/logs", label: "Logs & Proofs" },
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
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
        <AdminSidebar items={navItems} userName={displayName} userEmail={userEmail} />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-gray-200 bg-white px-4 py-4 shadow-sm lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">BinBird</p>
                <p className="text-lg font-semibold text-gray-900">Admin Control</p>
              </div>
              <div className="w-32">
                <AdminSignOutButton />
              </div>
            </div>
          </header>
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 lg:hidden">
            <AdminMobileNav items={navItems} />
          </div>
          <main className="flex-1 overflow-y-auto bg-white px-4 py-6 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
