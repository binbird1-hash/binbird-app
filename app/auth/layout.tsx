import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-white">Welcome to BinBird</h1>
          <p className="text-sm text-white/60">
            Sign in to manage your bins or jobs.
          </p>
        </div>
        <div className="w-full rounded-3xl border border-white/10 bg-black/70 p-8 shadow-2xl shadow-black/50 backdrop-blur">
          {children}
        </div>
        <p className="mt-10 text-center text-xs text-white/50">
          Need help?{" "}
          <a
            className="font-medium text-binbird-red underline-offset-4 hover:underline"
            href="mailto:support@binbird.com"
          >
            Contact support
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
