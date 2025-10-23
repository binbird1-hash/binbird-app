"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import AdminSignOutButton from "./AdminSignOutButton";

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
};

type AdminSidebarProps = {
  items: AdminNavItem[];
  userName: string;
  userEmail: string;
};

export default function AdminSidebar({ items, userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 flex-col justify-between border-r border-slate-800 bg-slate-950/95 p-6 lg:flex">
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Control Center</h1>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            return (
              <Fragment key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-red-500/10 text-red-200"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.description && (
                    <span className="mt-1 block text-xs text-slate-400">{item.description}</span>
                  )}
                </Link>
              </Fragment>
            );
          })}
        </nav>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Signed in</p>
          <p className="font-semibold text-white">{userName}</p>
          <p className="text-xs text-slate-400">{userEmail}</p>
        </div>
        <AdminSignOutButton />
      </div>
    </aside>
  );
}
