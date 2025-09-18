// app/auth/layout.tsx
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {children}
      </div>
      <p className="mt-6 text-xs text-white/60">
        © {new Date().getFullYear()} BinBird
      </p>
    </div>
  );
}
