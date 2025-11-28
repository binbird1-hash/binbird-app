"use client";

import { Suspense } from "react";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import ProofPageContent from "./proof-content";

export default function ProofPage() {
  return (
    <Suspense fallback={<PortalLoadingScreen />}>
      <div className="min-h-dvh overflow-y-auto bg-black text-white">
        <ProofPageContent />
      </div>
    </Suspense>
  );
}
