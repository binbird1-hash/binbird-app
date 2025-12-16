import LogsViewer, { type LogsViewerLog } from "@/components/admin/LogsViewer";
import { supabaseServer } from "@/lib/supabaseServer";

export const metadata = {
  title: "Logs • Admin",
};

async function loadLogs() {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("logs")
      .select("id, task_type, address, done_on, photo_path")
      .order("done_on", { ascending: false });

    const logs = (data ?? []) as LogsViewerLog[];

    const photoPaths = Array.from(
      new Set(logs.map((log) => log.photo_path ?? null).filter((value): value is string => Boolean(value))),
    );

    const signedUrls: Record<string, string> = {};
    if (photoPaths.length > 0) {
      const { data: signed, error } = await supabase.storage.from("proofs").createSignedUrls(photoPaths, 60 * 60);

      if (!error && signed) {
        for (const entry of signed) {
          if (entry.path && entry.signedUrl) {
            signedUrls[entry.path] = entry.signedUrl;
          }
        }
      }
    }

    return { logs, signedUrls };
  } catch (error) {
    console.error("Failed to load admin logs", error);
    return { logs: [], signedUrls: {} };
  }
}

export default async function AdminLogsPage() {
  const { logs, signedUrls } = await loadLogs();

  return <LogsViewer logs={logs} signedUrls={signedUrls} />;
}
