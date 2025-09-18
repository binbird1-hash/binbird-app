'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Property = {
  id: number
  address: string
  bins: string[]
  collectionDay: string
}

export default function ClientPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<Property[]>([])

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)

      // TODO: fetch real properties from Supabase
      setProperties([
        {
          id: 1,
          address: '12 Smith Street, Richmond',
          bins: ['Red', 'Yellow', 'Green'],
          collectionDay: 'Tuesday',
        },
        {
          id: 2,
          address: '45 Greenvale Rd, Brunswick',
          bins: ['Red', 'Green'],
          collectionDay: 'Thursday',
        },
      ])

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <p>Loading your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white py-6 shadow">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-binbird-red">BinBird</h1>
          <span className="text-sm">Signed in as {user.email}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <h2 className="text-xl font-semibold mb-6 text-gray-800">
          Your Properties
        </h2>

        {properties.length === 0 ? (
          <p className="text-gray-500">No properties linked to your account.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {properties.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl shadow p-6 border border-gray-200"
              >
                <h3 className="text-lg font-bold text-binbird-red">
                  {p.address}
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  Collection Day: {p.collectionDay}
                </p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {p.bins.map((bin) => (
                    <span
                      key={bin}
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${
                        bin === 'Red'
                          ? 'bg-red-500 text-white'
                          : bin === 'Yellow'
                          ? 'bg-yellow-400 text-black'
                          : 'bg-green-500 text-white'
                      }`}
                    >
                      {bin}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
