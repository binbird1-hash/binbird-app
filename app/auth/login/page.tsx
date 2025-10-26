import { Suspense } from "react";
import SignInClient from "./SignInClient";

export const metadata = {
  title: "Sign in to BinBird",
};

export default function AuthLoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInClient />
    </Suspense>
  );
}
