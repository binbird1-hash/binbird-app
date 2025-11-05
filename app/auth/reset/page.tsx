"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to send reset link. Please try again.");
        setStatus("idle");
        return;
      }

      setStatus("sent");
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Something went wrong. Please try again.";
      setError(message);
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">
          Reset your password
        </h2>
        <p className="text-sm text-white/60">
          Enter the email connected to your BinBird account and we&apos;ll send
          you a secure reset link.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {status === "sent" ? (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-200">
          Password reset instructions have been sent to{" "}
          <strong className="font-semibold">{email}</strong>. Check your inbox
          and follow the link within the next 24 hours.
        </div>
      ) : (
        <label
          className="block text-left text-sm font-medium text-white/80"
          htmlFor="email"
        >
          Email
          <input
            id="email"
            type="email"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
      )}

      {status !== "sent" && (
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff6c6c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send reset link"}
        </button>
      )}

      <p className="text-center text-sm text-white/60">
        Remembered your password?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-binbird-red hover:text-[#ff6c6c]"
        >
          Return to sign in
        </Link>
        .
      </p>
    </form>
  );
}
