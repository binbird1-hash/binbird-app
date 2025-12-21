import PhotoLibrary, { type PhotoLibraryItem } from "@/components/admin/PhotoLibrary";
import { normalizeProofPreference, type ProofPhotoPreference } from "@/lib/proof-photos";
import { supabaseServer } from "@/lib/supabaseServer";
import { getWeekInfoFromIso } from "@/lib/weeks";

export const metadata = {
  title: "Photos • Admin",
};

async function loadPhotos(): Promise<{
  photos: PhotoLibraryItem[];
  preferences: ProofPhotoPreference[];
}> {
  try {
    const supabase = await supabaseServer();

    const { data: logs } = await supabase
      .from("logs")
      .select(
        "id, job_id, property_id, account_id, client_name, address, task_type, photo_path, done_on, created_at",
      )
      .not("photo_path", "is", null)
      .order("created_at", { ascending: false });

    const jobIds = Array.from(
      new Set(
        (logs ?? [])
          .map((log) => log.job_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const jobLookup = new Map<string, { property_id: string | null; client_name: string | null; address: string | null }>();
    if (jobIds.length) {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, property_id, client_name, address")
        .in("id", jobIds);

      for (const job of jobs ?? []) {
        jobLookup.set(job.id, {
          property_id: job.property_id ?? null,
          client_name: job.client_name ?? null,
          address: job.address ?? null,
        });
      }
    }

    const photos: PhotoLibraryItem[] = (logs ?? [])
      .filter((log) => Boolean(log.photo_path))
      .map((log) => {
        const job = log.job_id ? jobLookup.get(log.job_id) : null;
        const completionDate = log.done_on ?? log.created_at ?? null;
        const weekInfo = getWeekInfoFromIso(completionDate);

        return {
          id: String(log.id),
          jobId: log.job_id ?? null,
          propertyId: log.property_id ?? job?.property_id ?? null,
          clientName: job?.client_name ?? log.client_name ?? null,
          address: job?.address ?? log.address ?? null,
          photoPath: log.photo_path!,
          taskType: log.task_type === "bring_in" ? "bring_in" : "put_out",
          completedOn: completionDate,
          weekLabel: weekInfo.label,
          weekParity: weekInfo.parity,
          year: weekInfo.year,
        } satisfies PhotoLibraryItem;
      });

    const propertyIds = Array.from(
      new Set(photos.map((photo) => photo.propertyId).filter((value): value is string => Boolean(value))),
    );

    let preferences: ProofPhotoPreference[] = [];
    if (propertyIds.length) {
      const { data } = await supabase
        .from("proof_photo_preferences")
        .select("id, property_id, job_type, parity, photo_path, created_at")
        .in("property_id", propertyIds);

      preferences = (data ?? [])
        .map((row) => normalizeProofPreference(row))
        .filter((value): value is ProofPhotoPreference => Boolean(value));
    }

    return { photos, preferences };
  } catch (error) {
    console.error("Failed to load photos", error);
    return { photos: [], preferences: [] };
  }
}

export default async function AdminPhotosPage() {
  const { photos, preferences } = await loadPhotos();

  return <PhotoLibrary photos={photos} preferences={preferences} />;
}
