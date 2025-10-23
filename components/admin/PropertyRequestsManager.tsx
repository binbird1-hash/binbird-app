"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useSupabase } from "@/components/providers/SupabaseProvider";

const formatAddress = (parts: Array<string | null>) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(", ");

type PropertyRequestRow = {
  id: string;
  status: string | null;
  account_id: string | null;
  account_name: string | null;
  requester_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  start_date: string | null;
  instructions: string | null;
  created_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  client_property_id: string | null;
};

const describeStatus = (status: string | null | undefined) => {
  if (!status) return "pending";
  return status.toLowerCase();
};

const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return format(date, "dd MMM yyyy • h:mm a");
};

export default function PropertyRequestsManager() {
  const supabase = useSupabase();
  const [requests, setRequests] = useState<PropertyRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("property_requests")
      .select(
        "id, status, account_id, account_name, requester_email, address_line1, address_line2, suburb, city, state, postal_code, start_date, instructions, created_at, approved_at, approved_by, client_property_id",
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      console.warn("Failed to load property requests", loadError);
      setRequests([]);
      setError("Unable to load property requests right now.");
    } else {
      setRequests((data ?? []) as PropertyRequestRow[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingCount = useMemo(
    () => requests.filter((request) => describeStatus(request.status) === "pending").length,
    [requests],
  );

  const handleApprove = useCallback(
    async (requestRow: PropertyRequestRow) => {
      if (!requestRow.id) return;
      setApprovingId(requestRow.id);
      setError(null);
      try {
        const response = await fetch(`/api/property-requests/${requestRow.id}/approve`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = typeof payload?.message === "string" ? payload.message : "Approval failed.";
          throw new Error(message);
        }

        const payload = await response.json().catch(() => ({ request: null }));
        const updated = payload?.request as PropertyRequestRow | null;

        if (updated) {
          setRequests((current) =>
            current.map((entry) => (entry.id === requestRow.id ? { ...entry, ...updated } : entry)),
          );
        } else {
          await loadRequests();
        }
      } catch (approvalError) {
        console.error("Failed to approve property request", approvalError);
        setError(
          approvalError instanceof Error
            ? approvalError.message
            : "Unable to approve the property request. Please try again.",
        );
      } finally {
        setApprovingId(null);
      }
    },
    [loadRequests],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Property Requests</h2>
          <p className="text-sm text-slate-300">
            Review client submitted properties and approve them to add entries to the client list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            disabled={loading}
          >
            Refresh
          </button>
          <span className="text-xs text-slate-400">{pendingCount} pending</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-300">Loading property requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-300">No property requests yet.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((requestRow) => {
            const status = describeStatus(requestRow.status);
            const address = formatAddress([
              requestRow.address_line1,
              requestRow.address_line2,
              requestRow.suburb,
              requestRow.city,
              requestRow.state,
              requestRow.postal_code,
            ]);
            const createdAt = formatDateTime(requestRow.created_at);
            const approvedAt = formatDateTime(requestRow.approved_at);

            return (
              <li key={requestRow.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">
                      {requestRow.account_name || "Client account"}
                    </h3>
                    <p className="text-sm text-slate-300">{address || requestRow.address_line1 || "Address pending"}</p>
                    {requestRow.requester_email && (
                      <p className="text-xs text-slate-400">Requested by {requestRow.requester_email}</p>
                    )}
                    {requestRow.start_date && (
                      <p className="text-xs text-slate-400">Preferred start: {requestRow.start_date}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        status === "approved"
                          ? "bg-green-500/10 text-green-300"
                          : status === "pending"
                          ? "bg-yellow-500/10 text-yellow-200"
                          : "bg-slate-700 text-slate-200"
                      }`}
                    >
                      {status}
                    </span>
                    {requestRow.client_property_id && (
                      <span className="text-xs text-slate-400">Property ID: {requestRow.client_property_id}</span>
                    )}
                    {createdAt && <span className="text-xs text-slate-500">Submitted {createdAt}</span>}
                    {approvedAt && <span className="text-xs text-slate-500">Approved {approvedAt}</span>}
                  </div>
                </div>
                {requestRow.instructions && (
                  <div className="mt-4 rounded-lg bg-slate-800/70 p-3 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Instructions</p>
                    <p className="mt-1 whitespace-pre-line">{requestRow.instructions}</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="text-xs text-slate-400">Account ID: {requestRow.account_id || "—"}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(requestRow)}
                      disabled={status !== "pending" || approvingId === requestRow.id}
                      className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                    >
                      {approvingId === requestRow.id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
