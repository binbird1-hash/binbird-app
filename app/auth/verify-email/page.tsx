import { Suspense } from "react";

import VerifyEmailClient from "./VerifyEmailClient";

export const metadata = {
  title: "Verify your email",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-white">Loading…</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
