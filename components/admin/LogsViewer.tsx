"use client";

import { useEffect, useState } from "react";
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
    return <p className="text-sm text-slate-300">Loading logs…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Logs & Proofs</h2>
        <p className="text-sm text-slate-300">
          Review completed work, timestamps, and access proof photos shared with clients.
        </p>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-slate-300">No logs yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{log.task_type ?? "Task"}</p>
                  <p className="text-xs text-slate-400">{log.address ?? "—"}</p>
                </div>
                {log.done_on && (
                  <p className="text-xs text-slate-500">{new Date(log.done_on).toLocaleString()}</p>
                )}
              </div>
              {log.photo_path && signedUrls[log.photo_path] && (
                <a
                  href={signedUrls[log.photo_path]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-red-300 hover:text-red-200"
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
