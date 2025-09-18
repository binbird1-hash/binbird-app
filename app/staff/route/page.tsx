"use client";

import { Suspense } from "react";
import RoutePageContent from "./route-content";

export default function StaffRoutePage() {
  return (
    <Suspense fallback={<div className="p-6 text-white bg-black">Loading route…</div>}>
      <RoutePageContent />
    </Suspense>
  );
}
