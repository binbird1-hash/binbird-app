// app/auth/sign-up/page.tsx
import { redirect } from "next/navigation";

export default function AuthSignUpRedirectPage() {
  redirect("/staff/sign-up");
}
