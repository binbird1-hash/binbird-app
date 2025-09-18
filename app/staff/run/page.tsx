"use client";

import { Suspense } from "react";
import RunPageContent from "./run-content";

export default function StaffRunPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white bg-black">Loading run…</div>}>
      <RunPageContent />
    </Suspense>
  );
}
