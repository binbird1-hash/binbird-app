'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CreditCardIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabaseClient'
import { useClientPortal } from './ClientPortalProvider'
import { saveAs } from 'file-saver'

export type Invoice = {
  id: string
  amount: number
  status: 'paid' | 'due' | 'overdue'
  issuedAt: string
  dueAt: string
  downloadUrl?: string | null
}

export function BillingOverview() {
  const { selectedAccount } = useClientPortal()
  const [planName, setPlanName] = useState('Waste Pro')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAccount) return
    let cancelled = false
    const fetchBilling = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('id, amount_cents, status, issued_at, due_at, pdf_url, plan_name')
        .eq('account_id', selectedAccount.id)
        .order('issued_at', { ascending: false })
        .limit(10)

      if (cancelled) return

      if (error) {
        setError('Unable to load billing history right now.')
        setInvoices([])
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        setPlanName(data[0].plan_name ?? 'Waste Pro')
      }

      setInvoices(
        (data ?? []).map((invoice) => ({
          id: String(invoice.id),
          amount: (invoice.amount_cents ?? 0) / 100,
          status: (invoice.status as Invoice['status']) ?? 'due',
          issuedAt: invoice.issued_at,
          dueAt: invoice.due_at,
          downloadUrl: invoice.pdf_url,
        })),
      )
      setLoading(false)
    }

    fetchBilling()

    return () => {
      cancelled = true
    }
  }, [selectedAccount])

  const handleDownload = async (invoice: Invoice) => {
    if (!invoice.downloadUrl) return
    const response = await fetch(invoice.downloadUrl)
    const blob = await response.blob()
    saveAs(blob, `binbird-invoice-${invoice.id}.pdf`)
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/50">Current plan</span>
          <h3 className="text-2xl font-semibold text-white">{planName}</h3>
          <p className="text-sm text-white/60">
            BinBird keeps your bins immaculate. Update payment details or plan tier anytime by contacting your account manager.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
        <header className="mb-4 flex items-center gap-3 text-sm text-white/60">
          <CreditCardIcon className="h-5 w-5" /> Recent invoices
        </header>
        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center text-white/60">
            <span className="flex items-center gap-3">
              <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" /> Loading invoices…
            </span>
          </div>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-white/60">No invoices issued for this account yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">{invoice.id}</td>
                    <td className="px-4 py-3 text-white/70">{format(new Date(invoice.issuedAt), 'PP')}</td>
                    <td className="px-4 py-3 text-white/70">{format(new Date(invoice.dueAt), 'PP')}</td>
                    <td className="px-4 py-3 text-white">${invoice.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ' +
                          (invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-300'
                            : invoice.status === 'overdue'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-200')
                        }
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownload(invoice)}
                        disabled={!invoice.downloadUrl}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white transition hover:border-binbird-red disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/30"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
