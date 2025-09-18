'use client'
import Header from '../UI/Header'

export default function GuestDashboard() {
  function handleSignIn() {
    window.location.href = '/auth'
  }

  return (
    <div className="wrap">
      <Header title="Welcome to BinBird" />
      <p className="text-center mb-6">Please sign in to access your dashboard.</p>
      <div className="actions">
        <button className="btn" onClick={handleSignIn}>
          Sign In / Sign Up
        </button>
      </div>
    </div>
  )
}
