// app/staff/proof/page.tsx
"use client";

import { Suspense } from "react";
import ProofPageContent from "./proof-content";

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading…</div>}>
      <ProofPageContent />
    </Suspense>
  );
}
