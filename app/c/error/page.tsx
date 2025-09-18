// app/c/error/page.tsx
import BackButton from '@/components/UI/BackButton'

export default function ClientPortalError() {
  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-2">Invalid or Expired Token</h2>
      <p className="opacity-80 mb-4">
        This client portal link is not valid or has expired.  
        Please check with your property manager or contact support for a new link.
      </p>
      <a href="/" className="btn">
        Go Home
      </a>
    </div>
  )
}
