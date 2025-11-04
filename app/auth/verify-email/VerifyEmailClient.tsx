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
    return emailFromQuery ?? "example@gmail.com";
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
    <div className="flex min-h-screen items-center justify-center bg-black px-6 py-12 sm:px-8">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-8 shadow-2xl sm:p-10">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-binbird-red">
            Secure sign up
          </p>
          <h1 className="text-3xl font-semibold text-black">Verification</h1>
          <p className="text-sm leading-6 text-neutral-600">
            Enter the verification code that was sent to
            <span className="font-semibold text-black"> {emailToDisplay}</span>. If you don’t find
            the email in your inbox, please check your spam folder.
          </p>
        </div>

        {!hasPendingData && (
          <div className="mt-6 rounded-2xl border border-yellow-400/40 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            We couldn’t find your sign up session. Please start over.
          </div>
        )}

        {status && (
          <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-8 space-y-6">
          <div className="space-y-2">
            <label htmlFor="verification-code" className="block text-sm font-medium text-neutral-700">
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
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.5em] text-black placeholder:text-neutral-300 focus:border-binbird-red focus:outline-none focus:ring-4 focus:ring-binbird-red/20"
              placeholder="123456"
              disabled={!hasPendingData || loading}
              required
            />
            <p className="text-xs text-neutral-500">Code is 6 digits without spaces</p>
          </div>

          <button
            type="submit"
            disabled={!hasPendingData || loading || code.length !== 6}
            className="w-full rounded-2xl bg-binbird-red py-3 text-base font-semibold text-white shadow-[0_18px_30px_-12px_rgba(255,87,87,0.55)] transition hover:bg-[#ff6c6c] focus:outline-none focus:ring-4 focus:ring-binbird-red/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          <p className="text-neutral-500">Didn’t get the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={!hasPendingData || resending}
            className="font-semibold text-binbird-red hover:text-[#ff6c6c] disabled:opacity-60"
          >
            {resending ? "Resending…" : "Resend code"}
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-neutral-400">
          <button
            type="button"
            onClick={() => router.push("/auth/sign-up")}
            className="font-medium text-binbird-red hover:text-[#ff6c6c]"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
