"use client";

import { Suspense } from "react";
import RunPageContent from "./run-content";

export default function StaffRunPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-950 to-red-950 px-6 text-white">
          <div className="rounded-3xl border border-white/10 bg-black/70 px-6 py-4 text-sm font-medium text-white/80 shadow-2xl shadow-black/40 backdrop-blur">
            Loading staff run experience…
          </div>
        </div>
      }
    >
      <RunPageContent />
    </Suspense>
  );
}
