'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => {
    if (pathname.startsWith('/staff')) {
      router.push('/staff/today')   // staff dashboard
    } else if (pathname.startsWith('/ops')) {
      router.push('/ops/clients')   // ops dashboard
    } else if (pathname.startsWith('/c/')) {
      router.push('/c/error')       // client portal fallback
    } else {
      router.back()                 // default back
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="btn"   // 👈 keep your existing 'btn' class for styling
    >
      ← Back
    </button>
  )
}
