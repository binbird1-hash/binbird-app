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
    <aside className="hidden min-h-screen w-72 flex-col justify-between border-r border-gray-200 bg-gray-50 p-6 lg:flex">
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Control Center</h1>
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
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.description && (
                    <span className="mt-1 block text-xs text-gray-500">{item.description}</span>
                  )}
                </Link>
              </Fragment>
            );
          })}
        </nav>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Signed in</p>
          <p className="font-semibold text-gray-900">{userName}</p>
          <p className="text-xs text-gray-600">{userEmail}</p>
        </div>
        <AdminSignOutButton />
      </div>
    </aside>
  );
}
