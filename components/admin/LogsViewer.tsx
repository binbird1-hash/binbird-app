"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type LogsViewerLog = {
  id: string;
  task_type: string | null;
  address: string | null;
  done_on: string | null;
  created_at: string | null;
  photo_path: string | null;
  bins: string | string[] | null;
  notes: string | null;
  user_id: string | null;
};

type LogsViewerProps = {
  logs: LogsViewerLog[];
  signedUrls: Record<string, string>;
  assigneeLookup: Record<string, string>;
};

export default function LogsViewer({ logs, signedUrls, assigneeLookup }: LogsViewerProps) {
  const router = useRouter();
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedJobType, setSelectedJobType] = useState<
    "put_out" | "bring_in" | ""
  >("");
  const [proofPreview, setProofPreview] = useState<{ url: string; description: string } | null>(null);
  const [purging, setPurging] = useState(false);

  const addressOptions = useMemo(() => {
    const addresses = logs
      .map((log) => log.address?.trim())
      .filter((value): value is string => Boolean(value && value.length));
    return Array.from(new Set(addresses)).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAddress =
        !selectedAddress.length || (log.address ?? "") === selectedAddress;
      const matchesJobType =
        !selectedJobType.length || log.task_type === selectedJobType;
      return matchesAddress && matchesJobType;
    });
  }, [logs, selectedAddress, selectedJobType]);

  const formatTimestamp = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Australia/Melbourne",
      hour12: false,
    }).format(parsed);
  };

  const taskLabel = (taskType: string | null) => {
    if (taskType === "bring_in") return "Bring in";
    if (taskType === "put_out") return "Put out";
    return "Task";
  };

  const binsLabel = (bins: string | string[] | null) => {
    if (!bins) return "";
    const list = Array.isArray(bins) ? bins : bins.split(",");
    const parts = list
      .map((bin) => bin.trim())
      .filter(Boolean)
      .map((bin) => bin.charAt(0).toUpperCase() + bin.slice(1));
    return parts.join(", ");
  };

  const handlePurgeOldLogs = async () => {
    try {
      setPurging(true);
      const response = await fetch("/api/admin/logs/purge-old", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to delete old logs");
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to delete old logs. Please try again.");
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Logs & Proofs</h2>
            <p className="text-sm text-gray-700">
              Review completed work, timestamps, and access proof photos shared with clients.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handlePurgeOldLogs}
              disabled={purging}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {purging ? "Deleting old logs…" : "Delete logs older than 6 weeks"}
            </button>
            <label className="flex w-full flex-col text-sm text-gray-900 sm:w-72">
              <span className="font-medium text-gray-800">Filter by property address</span>
              <select
                value={selectedAddress}
                onChange={(event) => setSelectedAddress(event.target.value)}
                className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">All addresses</option>
                {addressOptions.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {["put_out", "bring_in"].map((type) => {
            const isActive = selectedJobType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setSelectedJobType((current) =>
                    current === type ? "" : (type as "put_out" | "bring_in"),
                  )
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-gray-900 text-white shadow"
                    : "border border-gray-300 bg-white text-gray-800 hover:border-gray-400"
                }`}
              >
                {type === "put_out" ? "Put out" : "Bring in"}
              </button>
            );
          })}
        </div>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs yet.</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs match that address.</p>
      ) : (
        <ul className="space-y-2">
          {filteredLogs.map((log) => {
            const proofUrl = log.photo_path ? signedUrls[log.photo_path] : undefined;

            return (
              <li key={log.id} className="rounded-xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {log.address ?? "Property"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-800">
                        {taskLabel(log.task_type)}
                        {binsLabel(log.bins) ? ` • ${binsLabel(log.bins)}` : ""}
                      </span>
                      <span className="text-gray-700">
                        Assignee: {log.user_id ? assigneeLookup[log.user_id] ?? "Team member" : "Unassigned"}
                      </span>
                    </div>
                    {log.notes ? (
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold">Notes:</span> {log.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right text-xs text-gray-600">
                    {(log.created_at || log.done_on) && (
                      <p>{formatTimestamp(log.created_at ?? log.done_on ?? "")}</p>
                    )}
                    {proofUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setProofPreview({
                            url: proofUrl,
                            description: `${taskLabel(log.task_type)} proof for ${log.address ?? "property"}`,
                          })
                        }
                        className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
                      >
                        View proof
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {proofPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setProofPreview(null);
            }
          }}
        >
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setProofPreview(null)}
              className="absolute right-4 top-4 rounded-full border border-gray-300 bg-white p-2 text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
            >
              Close
            </button>
            <div className="mt-4 flex justify-center">
              <img
                src={proofPreview.url}
                alt={proofPreview.description}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
