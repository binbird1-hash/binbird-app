'use client'
import Header from '../UI/Header'
import Card from '../UI/Card'
import {
  Users,
  Cog,
  FileText,
  KeyRound,
  LogOut,
  ClipboardList,
  ClipboardCheck,
  CalendarCheck2,
  UserCog,
  BarChart3,
} from 'lucide-react'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export default function AdminDashboard() {
  const supabase = useSupabase()
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-black">
      <Header title="Admin Console" />
      <p className="mx-auto max-w-3xl text-center text-base text-black/70">
        Oversee property onboarding, manage client records, and coordinate staff assignments across the BinBird platform.
      </p>

      <div className="mx-auto mt-8 flex w-full max-w-5xl flex-col gap-10">
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Property onboarding</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              title="Approve property requests"
              description="Review and accept new service submissions before they reach the client list."
              icon={ClipboardCheck}
              href="/ops/property-requests"
            />
            <Card
              title="Manage client list"
              description="Edit property schedules, bin details, and account ownership."
              icon={Users}
              href="/ops/clients"
            />
            <Card
              title="Client access tokens"
              description="Issue or revoke client portal tokens for property stakeholders."
              icon={KeyRound}
              href="/ops/tokens"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Operations overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              title="Ops dashboard"
              description="Track client growth and proof submissions at a glance."
              icon={BarChart3}
              href="/ops/dashboard"
            />
            <Card
              title="Ops console"
              description="Run automation workflows and access advanced tools."
              icon={Cog}
              href="/ops"
            />
            <Card
              title="Logs & proofs"
              description="Audit staff submissions and download service history."
              icon={FileText}
              href="/ops/logs"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-black/50">Staff coordination</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              title="Assign daily runs"
              description="Generate jobs for today and allocate them to the right staff members."
              icon={CalendarCheck2}
              href="/ops/generate"
            />
            <Card
              title="Weekly planner"
              description="Review workloads across the week to balance assignments."
              icon={UserCog}
              href="/staff/week"
            />
            <Card
              title="Monitor live runs"
              description="Jump into the staff run interface to see in-progress work."
              icon={ClipboardList}
              href="/staff/run"
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Card
            title="Sign out"
            description="Log out of the admin workspace when you're finished."
            icon={LogOut}
            onClick={signOut}
          />
        </div>
      </div>
    </div>
  )
}
