"use client";

import { ReactNode, useEffect } from "react";
import SettingsDrawer from "@/components/UI/SettingsDrawer";

interface RunShellProps {
  children: ReactNode;
}

export default function RunShell({ children }: RunShellProps) {
  useEffect(() => {
    // Lock the document scroll so the map stays pinned during run planning.
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
