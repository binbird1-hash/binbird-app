import "@/app/globals.css";
import type { ReactNode } from "react";

export default function ClientAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">
            BinBird Client Portal
          </p>
          <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-white/60">
            Manage your properties, follow service progress, and keep your
            stakeholders updated.
          </p>
        </div>
        <div className="w-full rounded-3xl border border-white/10 bg-black/70 p-8 shadow-2xl backdrop-blur">
          {children}
        </div>
        <p className="mt-10 text-center text-xs text-white/50">
          Ready to sign in?{" "}
          <a
            className="font-medium text-binbird-red underline-offset-4 hover:underline"
            href="/auth/login"
          >
            Go to the BinBird login
          </a>
          .
        </p>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.3em] text-white/30">
          © {new Date().getFullYear()} BinBird
        </p>
      </div>
    </div>
  );
}
