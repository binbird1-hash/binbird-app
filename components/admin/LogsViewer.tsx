"use client";

import { useMemo, useState } from "react";

export type LogsViewerLog = {
  id: string;
  task_type: string | null;
  address: string | null;
  done_on: string | null;
  photo_path: string | null;
};

type LogsViewerProps = {
  logs: LogsViewerLog[];
  signedUrls: Record<string, string>;
};

export default function LogsViewer({ logs, signedUrls }: LogsViewerProps) {
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedJobType, setSelectedJobType] = useState<
    "put_out" | "bring_in" | ""
  >("");

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
    if (taskType === "bring_in") return "Ring in";
    if (taskType === "put_out") return "Put out";
    return "Task";
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Logs & Proofs</h2>
            <p className="text-sm text-gray-700">
              Review completed work, timestamps, and access proof photos shared with clients.
            </p>
          </div>
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
                {type === "put_out" ? "Put out" : "Ring in"}
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
          {filteredLogs.map((log) => (
            <li key={log.id} className="rounded-xl border border-gray-200 bg-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {log.address ?? "Property"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-gray-800">
                      {taskLabel(log.task_type)}
                    </span>
                  </div>
                </div>
                {log.done_on && (
                  <p className="text-xs text-gray-600">{formatTimestamp(log.done_on)}</p>
                )}
              </div>
              {log.photo_path && signedUrls[log.photo_path] && (
                <a
                  href={signedUrls[log.photo_path]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-gray-900 hover:text-gray-700"
                >
                  View proof
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
