"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
  PendingSignUpData,
  clearPendingSignUp,
  loadPendingSignUp,
  savePendingSignUp,
} from "@/lib/auth/pendingSignup";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState<PendingSignUpData | null>(null);

  const emailFromQuery = searchParams?.get("email") ?? undefined;

  useEffect(() => {
    const stored = loadPendingSignUp();
    if (stored) {
      setPendingData(stored);
    }
  }, []);

  const emailToDisplay = useMemo(() => {
    if (pendingData) return pendingData.email;
    return emailFromQuery ?? "your email";
  }, [emailFromQuery, pendingData]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingData) {
      setError(
        "We couldn't find your sign up details. Please restart the sign up process."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: pendingData.email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("Verification failed. Please try again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: pendingData.password,
      data: {
        full_name: pendingData.fullName,
        phone: pendingData.phone,
        role: pendingData.role,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const userId =
      data.user?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null;

    if (userId) {
      const { error: profileError } = await supabase
        .from("user_profile")
        .upsert({
          user_id: userId,
          full_name: pendingData.fullName,
          phone: pendingData.phone,
          email: pendingData.email,
          role: pendingData.role,
        })
        .select();

      if (profileError) {
        setError(
          "Your email was verified, but we couldn't finish setting up your profile. Please contact support."
        );
        setLoading(false);
        return;
      }
    }

    clearPendingSignUp();

    const destination =
      pendingData.role === "staff" ? "/staff/run" : "/client/dashboard";

    router.push(destination);
  }

  async function handleResend() {
    if (!pendingData) {
      setError(
        "We couldn't find your sign up details. Please restart the sign up process."
      );
      return;
    }

    setResending(true);
    setError(null);
    setStatus(null);

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: pendingData.email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: pendingData.fullName,
          phone: pendingData.phone,
          role: pendingData.role,
        },
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setStatus("A new verification code has been sent to your email.");
      savePendingSignUp(pendingData);
    }

    setResending(false);
  }

  const hasPendingData = Boolean(pendingData);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-black/40 p-8 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Verify your email</h2>
          <p className="text-sm leading-relaxed text-white/70">
            Enter the 6-digit code we sent to <span className="font-medium text-white">{emailToDisplay}</span> to finish creating
            your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/auth/sign-up")}
          className="text-sm font-medium text-binbird-red transition hover:text-binbird-red/80"
        >
          Start over
        </button>
      </div>

      {!hasPendingData && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          We couldn’t find your sign up session. Please start over.
        </div>
      )}

      {status && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {status}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="verification-code"
            className="block text-sm font-medium text-white/80"
          >
            Verification code
          </label>
          <input
            id="verification-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/[^0-9]/g, ""));
              setError(null);
            }}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="123456"
            disabled={!hasPendingData || loading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={!hasPendingData || loading || code.length !== 6}
          className="w-full rounded-xl bg-binbird-red py-3 font-semibold text-white shadow-lg shadow-binbird-red/30 transition hover:bg-[#ff6c6c] focus:outline-none focus:ring-2 focus:ring-binbird-red/50 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Verify and continue"}
        </button>
      </form>

      <div className="space-y-2 text-center text-sm text-white/60">
        <p className="text-white/70">Didn’t get the code?</p>
        <button
          type="button"
          onClick={handleResend}
          disabled={!hasPendingData || resending}
          className="font-medium text-binbird-red transition hover:text-binbird-red/80 disabled:opacity-60"
        >
          {resending ? "Resending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}
