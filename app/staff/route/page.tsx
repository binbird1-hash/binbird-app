"use client";

import { Suspense } from "react";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import RoutePageContent from "./route-content";

export default function StaffRoutePage() {
  return (
    <Suspense fallback={<PortalLoadingScreen />}>
      <RoutePageContent />
    </Suspense>
  );
}
