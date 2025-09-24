"use client";

import { ReactNode, useEffect } from "react";
import SettingsDrawer from "@/components/UI/SettingsDrawer";

interface RouteShellProps {
  children: ReactNode;
}

export default function RouteShell({ children }: RouteShellProps) {
  useEffect(() => {
    // Lock scrolling while navigating between jobs so the map stays fixed in place.
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      <SettingsDrawer />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
        {children}
      </main>
    </div>
  );
}
