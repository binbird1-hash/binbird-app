// app/auth/sign-in/page.tsx
import { redirect } from "next/navigation";

export default function AuthSignInRedirectPage() {
  redirect("/staff/login");
}
