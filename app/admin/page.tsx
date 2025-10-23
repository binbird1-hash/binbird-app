import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

async function loadDashboardData() {
  const supabase = supabaseServer();

  const [clientsResult, pendingResult, jobsResult, logsResult] = await Promise.all([
    supabase.from("client_list").select("property_id", { count: "exact", head: true }),
    supabase
      .from("property_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("logs").select("id", { count: "exact", head: true }),
  ]);

  const stats = {
    clients: clientsResult.count ?? 0,
    pendingRequests: pendingResult.count ?? 0,
    jobs: jobsResult.count ?? 0,
    logs: logsResult.count ?? 0,
  };

  const { data: recentRequests } = await supabase
    .from("property_requests")
    .select("id, account_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: unassignedJobs } = await supabase
    .from("jobs")
    .select("id, address, day_of_week, job_type, assigned_to")
    .is("assigned_to", null)
    .order("day_of_week", { ascending: true })
    .limit(6);

  return {
    stats,
    recentRequests: recentRequests ?? [],
    unassignedJobs: unassignedJobs ?? [],
  };
}

const cardClass =
  "rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm transition hover:border-red-400 hover:shadow-lg hover:shadow-red-900/30";

export default async function AdminDashboardPage() {
  const { stats, recentRequests, unassignedJobs } = await loadDashboardData();

  const cards = [
    { label: "Active clients", value: stats.clients, href: "/admin/clients" },
    { label: "Pending requests", value: stats.pendingRequests, href: "/admin/property-requests" },
    { label: "Jobs scheduled", value: stats.jobs, href: "/admin/jobs" },
    { label: "Logs captured", value: stats.logs, href: "/admin/logs" },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Admin dashboard</h1>
        <p className="text-sm text-slate-300">
          Monitor requests, manage clients, and keep teams on track. Use the quick links below to dive into each workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={cardClass}>
            <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent property requests</h2>
              <p className="text-xs text-slate-400">Review the latest submissions awaiting approval.</p>
            </div>
            <Link
              href="/admin/property-requests"
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              View all
            </Link>
          </div>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-slate-300">No property requests submitted yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentRequests.map((request) => (
                <li key={request.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">{request.account_name ?? "Client account"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2 py-1 capitalize text-slate-200">
                      {request.status?.toLowerCase() ?? "pending"}
                    </span>
                    {request.created_at && (
                      <span>Submitted {new Date(request.created_at).toLocaleString()}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Unassigned jobs</h2>
              <p className="text-xs text-slate-400">Assign jobs to staff to keep the schedule balanced.</p>
            </div>
            <Link
              href="/admin/jobs"
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Manage jobs
            </Link>
          </div>
          {unassignedJobs.length === 0 ? (
            <p className="text-sm text-slate-300">All jobs are assigned.</p>
          ) : (
            <ul className="space-y-3">
              {unassignedJobs.map((job) => (
                <li key={job.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">{job.address ?? "Property"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-200">
                      {job.job_type === "bring_in" ? "Bring in" : "Put out"}
                    </span>
                    <span>{job.day_of_week ?? "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
