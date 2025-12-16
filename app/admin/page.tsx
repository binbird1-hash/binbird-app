import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

async function loadDashboardData() {
  const supabase = await supabaseServer();

  const [
    clientsResult,
    logsResult,
    jobsResult,
    unassignedJobsResult,
    staffResult,
  ] = await Promise.all([
    supabase
      .from("client_list")
      .select("property_id, client_name, company, address, assigned_to", {
        count: "exact",
      })
      .order("client_name", { ascending: true })
      .limit(6),
    supabase
      .from("logs")
      .select("id, client_name, address, task_type, done_on, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase
      .from("jobs")
      .select("id, address, day_of_week, job_type, assigned_to")
      .is("assigned_to", null)
      .order("day_of_week", { ascending: true })
      .limit(6),
    supabase
      .from("user_profile")
      .select("user_id, full_name")
      .in("role", ["staff", "admin"]),
  ]);

  const staffLookup = new Map(
    (staffResult.data ?? []).map((member) => [
      member.user_id,
      member.full_name?.trim().length ? member.full_name : "Team member",
    ]),
  );

  const stats = {
    clients: clientsResult.count ?? 0,
    jobs: jobsResult.count ?? 0,
    logs: logsResult.count ?? 0,
  };

  const recentClients = (clientsResult.data ?? []).map((client) => ({
    ...client,
    assigned_name: client.assigned_to ? staffLookup.get(client.assigned_to) ?? null : null,
  }));

  return {
    stats,
    recentClients,
    recentLogs: logsResult.data ?? [],
    unassignedJobs: unassignedJobsResult.data ?? [],
  };
}

const cardClass =
  "rounded-2xl border border-gray-200 bg-gray-100 p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md";

export default async function AdminDashboardPage() {
  const { stats, recentClients, recentLogs, unassignedJobs } = await loadDashboardData();

  const cards = [
    { label: "Active clients", value: stats.clients, href: "/admin/clients" },
    { label: "Jobs scheduled", value: stats.jobs, href: "/admin/jobs" },
    { label: "Logs captured", value: stats.logs, href: "/admin/logs" },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Admin dashboard</h1>
        <p className="text-sm text-gray-700">
          Monitor requests, manage clients, and keep teams on track. Use the quick links below to dive into each workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={cardClass}>
            <p className="text-xs uppercase tracking-wide text-gray-600">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Latest client updates</h2>
              <p className="text-xs text-gray-600">Keep track of newly added properties and account assignments.</p>
            </div>
            <Link
              href="/admin/clients"
              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
            >
              Manage clients
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <p className="text-sm text-gray-700">No client records found yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentClients.map((client) => (
                <li key={client.property_id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">{client.client_name ?? client.company ?? "Client account"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    {client.address && <span>{client.address}</span>}
                    {client.assigned_name && <span>Assigned to {client.assigned_name}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Unassigned jobs</h2>
              <p className="text-xs text-gray-600">Assign jobs to staff to keep the schedule balanced.</p>
            </div>
            <Link
              href="/admin/jobs"
              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
            >
              Manage jobs
            </Link>
          </div>
          {unassignedJobs.length === 0 ? (
            <p className="text-sm text-gray-700">All jobs are assigned.</p>
          ) : (
            <ul className="space-y-3">
              {unassignedJobs.map((job) => (
                <li key={job.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">{job.address ?? "Property"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-800">
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

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recent logs</h2>
            <p className="text-xs text-gray-600">Latest proof uploads and visit notes captured by the team.</p>
          </div>
          <Link
            href="/admin/logs"
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
          >
            View logs
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-gray-700">No logs recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentLogs.map((log) => (
              <li key={log.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">{log.address ?? log.client_name ?? "Log entry"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {log.task_type && <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-800">{log.task_type}</span>}
                  {log.done_on && <span>Completed {new Date(log.done_on).toLocaleString()}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
