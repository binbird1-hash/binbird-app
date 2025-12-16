"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";

type LogRow = {
  id: string;
  task_type: string | null;
  address: string | null;
  done_on: string | null;
  photo_path: string | null;
};

export default function LogsViewer() {
  const supabase = useSupabase();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [selectedAddress, setSelectedAddress] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("logs")
        .select("id, task_type, address, done_on, photo_path")
        .order("done_on", { ascending: false });
      setLogs((data ?? []) as LogRow[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  useEffect(() => {
    if (logs.length === 0) return;

    const photoPaths = logs
      .map((log) => log.photo_path ?? null)
      .filter((path): path is string => Boolean(path));

    const missingPaths = photoPaths.filter((path) => !signedUrls[path]);
    if (missingPaths.length === 0) return;

    const uniqueMissingPaths = Array.from(new Set(missingPaths));
    let cancelled = false;

    const loadSignedUrls = async () => {
      const { data, error } = await supabase.storage
        .from("proofs")
        .createSignedUrls(uniqueMissingPaths, 60 * 60);

      if (error) {
        console.warn("Failed to create signed proof URLs", error);
        return;
      }

      if (cancelled || !data) return;

      setSignedUrls((previous) => {
        const updated = { ...previous };
        for (const entry of data) {
          if (entry.path && entry.signedUrl) {
            updated[entry.path] = entry.signedUrl;
          }
        }
        return updated;
      });
    };

    loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [logs, signedUrls, supabase]);

  if (loading) {
    return <p className="text-sm text-gray-700">Loading logs…</p>;
  }

  const addressOptions = useMemo(() => {
    const addresses = logs
      .map((log) => log.address?.trim())
      .filter((value): value is string => Boolean(value && value.length));
    return Array.from(new Set(addresses)).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (!selectedAddress.length) return true;
    return (log.address ?? "") === selectedAddress;
  });

  return (
    <div className="space-y-4">
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
      {logs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs yet.</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-sm text-gray-700">No logs match that address.</p>
      ) : (
        <ul className="space-y-2">
          {filteredLogs.map((log) => (
            <li key={log.id} className="rounded-xl border border-gray-200 bg-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{log.task_type ?? "Task"}</p>
                  <p className="text-xs text-gray-600">{log.address ?? "—"}</p>
                </div>
                {log.done_on && (
                  <p className="text-xs text-gray-600">{new Date(log.done_on).toLocaleString()}</p>
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
