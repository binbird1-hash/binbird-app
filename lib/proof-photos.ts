export type ProofPhotoPreference = {
  id?: string;
  property_id: string | null;
  job_type: "put_out" | "bring_in";
  parity: "odd" | "even";
  photo_path: string;
  created_at?: string | null;
};

export function normalizeProofPreference(raw: Partial<ProofPhotoPreference>): ProofPhotoPreference | null {
  const propertyId = typeof raw.property_id === "string" && raw.property_id.trim().length ? raw.property_id : null;
  const jobType = raw.job_type === "bring_in" ? "bring_in" : raw.job_type === "put_out" ? "put_out" : null;
  const parity = raw.parity === "even" ? "even" : raw.parity === "odd" ? "odd" : null;
  const photoPath = typeof raw.photo_path === "string" ? raw.photo_path.trim() : "";

  if (!jobType || !parity || !photoPath) {
    return null;
  }

  return {
    id: raw.id,
    property_id: propertyId,
    job_type: jobType,
    parity,
    photo_path: photoPath,
    created_at: raw.created_at ?? null,
  };
}

export function groupPreferencesByProperty(
  preferences: ProofPhotoPreference[],
): Map<string, ProofPhotoPreference[]> {
  const map = new Map<string, ProofPhotoPreference[]>();
  for (const preference of preferences) {
    const propertyId = preference.property_id;
    if (!propertyId) continue;
    const existing = map.get(propertyId) ?? [];
    existing.push(preference);
    map.set(propertyId, existing);
  }
  return map;
}

export function findPreference(
  map: Map<string, ProofPhotoPreference[]>,
  propertyId: string | null | undefined,
  jobType: "put_out" | "bring_in",
  parity: "odd" | "even",
): ProofPhotoPreference | null {
  if (!propertyId) return null;
  const list = map.get(propertyId) ?? [];
  return (
    list.find((pref) => pref.job_type === jobType && pref.parity === parity) ??
    list.find((pref) => pref.job_type === jobType) ??
    null
  );
}
