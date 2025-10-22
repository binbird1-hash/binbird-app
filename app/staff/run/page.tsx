"use client";

import { Suspense } from "react";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import RunPageContent from "./run-content";

export default function StaffRunPage() {
  return (
    <Suspense fallback={<PortalLoadingScreen />}>
      <RunPageContent />
    </Suspense>
  );
}
