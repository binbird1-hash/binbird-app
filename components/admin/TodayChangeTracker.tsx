"use client";

import { useMemo, useState } from "react";

type TodayChange = {
  id: string;
  address: string | null;
  task_type: string | null;
  created_at: string | null;
  user_id: string | null;
};

type StatusState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "info"; message: string }
  | null;

type TodayChangeTrackerProps = {
  initialChanges: TodayChange[];
};

const formatTimestamp = (value: string | null) => {
  if (!value) return "Unknown time";
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
  return "Update";
};

export default function TodayChangeTracker({ initialChanges }: TodayChangeTrackerProps) {
  const [changes, setChanges] = useState<TodayChange[]>(initialChanges);
  const [status, setStatus] = useState<StatusState>(null);
  const [activeAction, setActiveAction] = useState<"undo" | "reset" | null>(null);

  const latestChange = useMemo(() => changes[0] ?? null, [changes]);

  const handleUndoLatest = async () => {
    if (!latestChange) {
      setStatus({ type: "info", message: "No changes recorded today to undo." });
      return;
    }
    const confirmed = window.confirm(
      "Are you sure you want to undo the most recent change recorded today? This will remove it from the log.",
    );
    if (!confirmed) return;
    setActiveAction("undo");
    setStatus(null);
    try {
      const response = await fetch("/api/admin/logs/undo-latest", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.removed) {
        throw new Error(payload?.error ?? "Unable to undo the latest change.");
      }
      const removedId: string | undefined = payload.removedId;
      setChanges((current) => (removedId ? current.filter((entry) => entry.id !== removedId) : current.slice(1)));
      setStatus({ type: "success", message: "Latest change was undone." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Failed to undo the latest change. Please try again." });
    } finally {
      setActiveAction(null);
    }
  };

  const handleResetDay = async () => {
    if (!changes.length) {
      setStatus({ type: "info", message: "No changes recorded today to reset." });
      return;
    }
    const confirmed = window.confirm(
      "Are you sure you want to reset today’s changes? This will clear all changes recorded today.",
    );
    if (!confirmed) return;
    setActiveAction("reset");
    setStatus(null);
    try {
      const response = await fetch("/api/admin/logs/reset-today", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to reset today’s changes.");
      }
      setChanges([]);
      setStatus({ type: "success", message: "All of today’s changes have been reset." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Failed to reset today’s changes. Please try again." });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Today&apos;s changes</h2>
          <p className="text-xs text-gray-600">
            Track adjustments made today and roll back if something needs to be reverted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleUndoLatest}
            disabled={activeAction !== null}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === "undo" ? "Undoing…" : "Undo latest change"}
          </button>
          <button
            type="button"
            onClick={handleResetDay}
            disabled={activeAction !== null}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeAction === "reset" ? "Resetting…" : "Reset today"}
          </button>
        </div>
      </div>

      {status ? (
        <p
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            status.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : status.type === "info"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      {changes.length === 0 ? (
        <p className="text-sm text-gray-700">No changes have been recorded today.</p>
      ) : (
        <ul className="space-y-3">
          {changes.map((change) => (
            <li key={change.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">
                {change.address ?? "Updated record"} · {taskLabel(change.task_type)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-800">
                  {formatTimestamp(change.created_at)}
                </span>
                <span>{change.user_id ? `By ${change.user_id}` : "Unassigned change"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
