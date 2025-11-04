"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowPathIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";

import { useSupabase } from "@/components/providers/SupabaseProvider";

type AccountRole = "staff" | "client";

type VerificationState = "idle" | "success" | "error";

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  if (!localPart) return email;
  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.slice(-1);
  const maskedLocal =
    localPart.length <= 3
      ? `${localPart[0] ?? "*"}${"*".repeat(Math.max(localPart.length - 1, 0))}`
      : `${visibleStart}${"*".repeat(Math.max(localPart.length - 3, 0))}${visibleEnd}`;

  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

export default function VerifyEmailClient() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<VerificationState>("idle");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  useEffect(() => {
    if (!email) {
      setError("No email address provided. Please return to the sign up form.");
    }
  }, [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email) {
      setError("Unable to verify without an email address.");
      return;
    }

    if (!code.trim()) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });

    if (verifyError) {
      setStatus("error");
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    if (!user) {
      setStatus("error");
      setError("Verification completed, but no user information was returned.");
      setLoading(false);
      return;
    }

    const metadata = user.user_metadata ?? {};
    const role = (metadata.role as AccountRole) ?? "staff";
    const fullName = (metadata.full_name as string) ?? "";
    const phone = (metadata.phone as string) ?? "";

    const { error: profileError } = await supabase
      .from("user_profile")
      .upsert({
        user_id: user.id,
        full_name: fullName,
        phone,
        email: user.email,
        role,
      })
      .select();

    if (profileError) {
      setStatus("error");
      setError(
        "Email verified, but we could not finish creating your profile. Please contact support.",
      );
      setLoading(false);
      return;
    }

    setStatus("success");
    setLoading(false);

    const destination = role === "staff" ? "/staff/run" : "/client/dashboard";

    router.replace(destination);
  }

  async function handleResend() {
    if (!email) return;

    setResending(true);
    setError("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      setError(resendError.message);
    }

    setResending(false);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">Verify your email</h2>
        {email ? (
          <p className="text-sm text-white/60">
            We sent a 6-digit code to <span className="font-semibold">{maskedEmail}</span>.
            Enter it below to finish creating your account.
          </p>
        ) : (
          <p className="text-sm text-red-200">
            We could not determine which email address to verify. Please go back and
            start the sign up process again.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="verification-code" className="sr-only">
            Verification code
          </label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/[^0-9]/g, ""));
              setError("");
            }}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-lg font-semibold tracking-[0.3em] text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
            autoComplete="one-time-code"
            disabled={!email || loading}
            required
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={!email || loading}
          className="w-full rounded-xl bg-binbird-red py-3 font-semibold text-white shadow-lg shadow-binbird-red/30 transition hover:bg-[#ff6c6c] focus:outline-none focus:ring-2 focus:ring-binbird-red/50 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Confirm email"}
        </button>
      </form>

      <div className="flex flex-col gap-3 text-sm text-white/60">
        <button
          type="button"
          onClick={handleResend}
          disabled={!email || resending}
          className="inline-flex items-center justify-center gap-2 text-binbird-red transition hover:text-[#ff6c6c] disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          {resending ? "Resending code…" : "Resend verification code"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/auth/sign-up")}
          className="inline-flex items-center justify-center gap-2 text-white/60 transition hover:text-white"
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
          Back to sign up
        </button>
      </div>

      {status === "success" && (
        <p className="text-center text-sm text-emerald-300">
          Email verified! Redirecting you to your dashboard…
        </p>
      )}
    </div>
  );
}
