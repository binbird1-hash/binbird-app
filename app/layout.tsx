// app/layout.tsx
import type { Metadata } from "next"
import { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "BinBird",
  description: "Bin management made simple",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-black antialiased">
        {children}
      </body>
    </html>
  )
}
