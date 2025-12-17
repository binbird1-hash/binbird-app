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
      .select("id, task_type, address, done_on, created_at, photo_path, bins, notes, user_id")
      .order("created_at", { ascending: false });

    const logs = (data ?? []) as LogsViewerLog[];

    const userIds = Array.from(new Set(logs.map((log) => log.user_id).filter((value): value is string => Boolean(value))));

    const assigneeLookup: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("user_profile")
        .select("user_id, full_name")
        .in("user_id", userIds);

      for (const profile of profiles ?? []) {
        assigneeLookup[profile.user_id] = profile.full_name?.trim().length
          ? profile.full_name
          : "Team member";
      }
    }

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

    return { logs, signedUrls, assigneeLookup };
  } catch (error) {
    console.error("Failed to load admin logs", error);
    return { logs: [], signedUrls: {}, assigneeLookup: {} };
  }
}

export default async function AdminLogsPage() {
  const { logs, signedUrls, assigneeLookup } = await loadLogs();

  return <LogsViewer logs={logs} signedUrls={signedUrls} assigneeLookup={assigneeLookup} />;
}
