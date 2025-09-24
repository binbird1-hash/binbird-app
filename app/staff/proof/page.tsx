"use client";

import { Suspense } from "react";
import ProofPageContent from "./proof-content";

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading…</div>}>
      <div className="flex h-dvh flex-col bg-black text-white">
        <main className="flex-1 overflow-y-auto">
          <ProofPageContent />
        </main>
      </div>
    </Suspense>
  );
}
