'use client'
import Header from '../UI/Header'

export default function GuestDashboard() {
  function handleSignIn() {
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white px-6 py-8">
      <Header title="Welcome to BinBird" />

      <main className="flex-1 flex flex-col items-center mt-8">
        <p className="text-center mb-6 text-white text-lg font-semibold">
          Please sign in or create an account to access your dashboard.
        </p>
        <button
          className="w-full max-w-xs py-4 rounded-xl bg-[#E21C21] text-white font-semibold text-lg hover:opacity-90 active:scale-95 transition"
          onClick={handleSignIn}
        >
          Sign In / Sign Up
        </button>
      </main>

      <footer className="text-center text-xs text-white/40 py-4">
        © {new Date().getFullYear()} BinBird
      </footer>
    </div>
  )
}
