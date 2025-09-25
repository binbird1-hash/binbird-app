"use client";

import { Suspense } from "react";
import ProofPageContent from "./proof-content";

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading…</div>}>
      <div className="h-dvh overflow-y-auto bg-black text-white">
        <ProofPageContent />
      </div>
    </Suspense>
  );
}
