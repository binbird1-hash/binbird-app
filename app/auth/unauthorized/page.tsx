export default function UnauthorizedPage() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold text-white">Access denied</h2>
      <p className="text-sm text-white/60">
        You do not have permission to view this area. Please contact BinBird support if you believe this is a mistake.
      </p>
      <a
        href="/auth/sign-in"
        className="inline-flex items-center justify-center rounded-xl bg-binbird-red px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-500"
      >
        Return to sign in
      </a>
    </div>
  )
}
