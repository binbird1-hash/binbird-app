"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [page, setPage] = useState(1);
  const [proofPreview, setProofPreview] = useState<{ url: string; description: string } | null>(null);
  const [notesPreview, setNotesPreview] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(1);
  }, [selectedAddress, selectedJobType, selectedAssignee]);

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
      const matchesAssignee =
        !selectedAssignee.length ||
        (selectedAssignee === "__unassigned__"
          ? !log.user_id
          : log.user_id === selectedAssignee);
      return matchesAddress && matchesJobType && matchesAssignee;
    });
  }, [logs, selectedAddress, selectedJobType, selectedAssignee]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE)), [filteredLogs.length]);
  const currentPage = Math.min(page, totalPages);
  const visibleLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredLogs]);

  const assigneeOptions = useMemo(() => {
    const withAssignee = logs
      .map((log) => log.user_id)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(withAssignee));

    const options = unique
      .map((userId) => ({ id: userId, label: assigneeLookup[userId] ?? "Team member" }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const hasUnassigned = logs.some((log) => !log.user_id);
    if (hasUnassigned) {
      options.unshift({ id: "__unassigned__", label: "Unassigned" });
    }

    return options;
  }, [assigneeLookup, logs]);

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
    if (!bins) return [] as string[];
    const list = Array.isArray(bins) ? bins : bins.split(",");
    return list
      .map((bin) => bin.trim())
      .filter(Boolean)
      .map((bin) => bin.charAt(0).toUpperCase() + bin.slice(1));
  };

  const binStyle = (bin: string) => {
    const lower = bin.toLowerCase();
    if (lower.includes("red")) return "bg-red-100 text-red-800 border-red-200";
    if (lower.includes("yellow")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (lower.includes("green")) return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
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
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Logs & Proofs</h2>
            <p className="text-sm text-gray-700">
              Review completed work, timestamps, and access proof photos shared with clients.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePurgeOldLogs}
            disabled={purging}
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 bg-red-600 text-white shadow hover:bg-red-700"
          >
            {purging ? "Deleting…" : "Purge Old Logs"}
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 lg:items-end lg:gap-4">
            <label className="flex w-full flex-col text-sm text-gray-900">
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
            <label className="flex w-full flex-col text-sm text-gray-900">
              <span className="font-medium text-gray-800">Filter by assignee</span>
              <select
                value={selectedAssignee}
                onChange={(event) => setSelectedAssignee(event.target.value)}
                className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">All assignees</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
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
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
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
        </div>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs yet.</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs match that address.</p>
      ) : (
        <ul className="space-y-3">
          {visibleLogs.map((log) => {
            const proofUrl = log.photo_path ? signedUrls[log.photo_path] : undefined;
            const binList = binsLabel(log.bins);

            return (
              <li key={log.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold text-gray-900">{log.address ?? "Property"}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-800">
                          {taskLabel(log.task_type)}
                        </span>
                        {binList.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {binList.map((bin) => (
                              <span
                                key={`${log.id}-${bin}`}
                                className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${binStyle(bin)}`}
                              >
                                {bin}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-gray-700">
                          Assignee: {log.user_id ? assigneeLookup[log.user_id] ?? "Team member" : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-start gap-3 text-xs text-gray-600 sm:w-auto sm:items-end sm:text-right">
                    {(log.created_at || log.done_on) && (
                      <p className="text-sm font-medium text-gray-800">
                        {formatTimestamp(log.created_at ?? log.done_on ?? "")}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                      {log.notes ? (
                        <button
                          type="button"
                          onClick={() => setNotesPreview(log.notes!)}
                          className="inline-flex items-center justify-center rounded-lg border border-yellow-300 bg-yellow-100 px-3 py-2 text-xs font-semibold text-yellow-900 transition hover:border-yellow-400 hover:bg-yellow-200"
                        >
                          View notes
                        </button>
                      ) : null}
                      {proofUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setProofPreview({
                              url: proofUrl,
                              description: `${taskLabel(log.task_type)} proof for ${log.address ?? "property"}`,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
                        >
                          View proof
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {filteredLogs.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-800">
          <p>
            Showing {Math.min(filteredLogs.length, (currentPage - 1) * PAGE_SIZE + 1)}-
            {Math.min(filteredLogs.length, currentPage * PAGE_SIZE)} of {filteredLogs.length} logs
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
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
      {notesPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setNotesPreview(null);
            }
          }}
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setNotesPreview(null)}
              className="absolute right-4 top-4 rounded-full border border-gray-300 bg-white p-2 text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
            >
              Close
            </button>
            <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{notesPreview}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
