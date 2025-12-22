"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { groupPreferencesByProperty, type ProofPhotoPreference } from "@/lib/proof-photos";

export type PhotoLibraryItem = {
  id: string;
  jobId: string | null;
  propertyId: string | null;
  clientName: string | null;
  address: string | null;
  photoPath: string;
  taskType: "put_out" | "bring_in";
  bins: string | null;
  completedOn: string | null;
  weekLabel: string | null;
  weekParity: "odd" | "even" | null;
  year: number | null;
};

type PhotoLibraryProps = {
  photos: PhotoLibraryItem[];
  preferences: ProofPhotoPreference[];
};

type SortKey = "date" | "client" | "property" | "week" | "jobType";

type PreferenceLookup = Map<string, ProofPhotoPreference[]>;

function formatDate(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" });
}

function buildPreferenceLookup(preferences: ProofPhotoPreference[]): PreferenceLookup {
  return groupPreferencesByProperty(preferences);
}

function describePreference(
  preferenceLookup: PreferenceLookup,
  photo: PhotoLibraryItem,
): { matchesOdd: boolean; matchesEven: boolean; hasAny: boolean } {
  const list = photo.propertyId ? preferenceLookup.get(photo.propertyId) ?? [] : [];
  const matchesOdd = list.some(
    (pref) => pref.parity === "odd" && pref.job_type === photo.taskType && pref.photo_path === photo.photoPath,
  );
  const matchesEven = list.some(
    (pref) => pref.parity === "even" && pref.job_type === photo.taskType && pref.photo_path === photo.photoPath,
  );
  return { matchesOdd, matchesEven, hasAny: list.length > 0 };
}

function normalizeBins(bins: string | null): string[] {
  if (!bins) return [];
  return bins
    .split(",")
    .map((bin) => bin.trim())
    .filter(Boolean);
}

function renderBinChip(bin: string) {
  const normalized = bin.toLowerCase();
  let color = "bg-gray-200 text-gray-900";

  if (normalized.includes("red")) color = "bg-red-100 text-red-800";
  else if (normalized.includes("yellow")) color = "bg-yellow-100 text-yellow-900";
  else if (normalized.includes("green")) color = "bg-green-100 text-green-800";

  return (
    <span key={bin} className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>
      {bin}
    </span>
  );
}

export default function PhotoLibrary({ photos, preferences }: PhotoLibraryProps) {
  const supabase = useSupabase();
  const router = useRouter();

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [taskType, setTaskType] = useState<"" | "put_out" | "bring_in">("");
  const [selectedYear, setSelectedYear] = useState<number | "">("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [preferenceLookup, setPreferenceLookup] = useState<PreferenceLookup>(buildPreferenceLookup(preferences));
  const [savingPreferenceFor, setSavingPreferenceFor] = useState<string | null>(null);

  useEffect(() => {
    setPreferenceLookup(buildPreferenceLookup(preferences));
  }, [preferences]);

  useEffect(() => {
    const missing = photos
      .map((photo) => photo.photoPath)
      .filter((path) => path && !signedUrls[path]);

    const uniqueMissing = Array.from(new Set(missing));
    if (!uniqueMissing.length) return;

    let cancelled = false;

    const loadSignedUrls = async () => {
      const { data, error } = await supabase.storage
        .from("proofs")
        .createSignedUrls(uniqueMissing, 60 * 60);

      if (error) {
        console.warn("Failed to load proof previews", error);
        return;
      }

      if (cancelled || !data) return;

      setSignedUrls((current) => {
        const next = { ...current };
        for (const entry of data) {
          if (entry.path && entry.signedUrl) {
            next[entry.path] = entry.signedUrl;
          }
        }
        return next;
      });
    };

    void loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [photos, signedUrls, supabase]);

  const clients = useMemo(() => {
    return Array.from(
      new Set(
        photos
          .map((photo) => photo.clientName?.trim())
          .filter((value): value is string => Boolean(value && value.length)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const properties = useMemo(() => {
    return Array.from(
      new Set(
        photos
          .map((photo) => photo.address?.trim())
          .filter((value): value is string => Boolean(value && value.length)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const weeks = useMemo(() => {
    return Array.from(
      new Set(
        photos
          .map((photo) => photo.weekLabel ?? undefined)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  const years = useMemo(() => {
    return Array.from(
      new Set(
        photos
          .map((photo) => photo.year ?? undefined)
          .filter((value): value is number => typeof value === "number"),
      ),
    ).sort((a, b) => a - b);
  }, [photos]);

  const filtered = useMemo(() => {
    return photos.filter((photo) => {
      const matchesType = !taskType || photo.taskType === taskType;
      const matchesYear = selectedYear === "" || photo.year === selectedYear;
      const matchesWeek = !selectedWeek || photo.weekLabel === selectedWeek;
      const matchesClient = !selectedClient || photo.clientName === selectedClient;
      const matchesProperty = !selectedProperty || photo.address === selectedProperty;
      return matchesType && matchesYear && matchesWeek && matchesClient && matchesProperty;
    });
  }, [photos, selectedClient, selectedProperty, selectedWeek, selectedYear, taskType]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "client") {
        return (a.clientName ?? "").localeCompare(b.clientName ?? "");
      }
      if (sortKey === "property") {
        return (a.address ?? "").localeCompare(b.address ?? "");
      }
      if (sortKey === "week") {
        return (a.weekLabel ?? "").localeCompare(b.weekLabel ?? "");
      }
      if (sortKey === "jobType") {
        return a.taskType.localeCompare(b.taskType);
      }
      const aDate = a.completedOn ? new Date(a.completedOn).getTime() : 0;
      const bDate = b.completedOn ? new Date(b.completedOn).getTime() : 0;
      return bDate - aDate;
    });
    return copy;
  }, [filtered, sortKey]);

  const handlePreference = async (
    photo: PhotoLibraryItem,
    parity: "odd" | "even",
  ) => {
    if (!photo.propertyId) {
      alert("This photo is not linked to a property yet.");
      return;
    }

    setSavingPreferenceFor(photo.id);
    try {
      const response = await fetch("/api/admin/proof-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: photo.propertyId,
          job_type: photo.taskType,
          parity,
          photo_path: photo.photoPath,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        const fallbackMessage = raw?.trim() || "Unable to save preference";

        try {
          const json = JSON.parse(raw) as { error?: string };
          const message = json?.error || fallbackMessage;
          throw new Error(message);
        } catch (err) {
          if (err instanceof Error) throw err;
          throw new Error(fallbackMessage);
        }
      }

      const json = (await response.json()) as { error?: string; preference?: ProofPhotoPreference | null };
      if (json?.error) throw new Error(json.error);

      const preference = json.preference;

      if (preference) {
        setPreferenceLookup((current) => {
          const next = new Map(current);
          const list = photo.propertyId ? [...(next.get(photo.propertyId) ?? [])] : [];
          const existingIdx = list.findIndex(
            (pref) => pref.job_type === photo.taskType && pref.parity === parity,
          );
          if (existingIdx >= 0) {
            list[existingIdx] = preference;
          } else {
            list.push(preference);
          }
          if (photo.propertyId) {
            next.set(photo.propertyId, list);
          }
          return next;
        });
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unable to save proof preference. Please try again.";
      alert(message);
    } finally {
      setSavingPreferenceFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-gray-900">Photo library</h1>
        <p className="text-sm text-gray-700">
          Browse all captured proof photos by client, property, week, and task type. Pick the exact photo to
          show crews on odd and even weeks.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Sort by</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="date">Newest first</option>
              <option value="client">Client</option>
              <option value="property">Property</option>
              <option value="week">Week</option>
              <option value="jobType">Task type</option>
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Task type</span>
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value as typeof taskType)}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All</option>
              <option value="put_out">Put out</option>
              <option value="bring_in">Bring in</option>
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Client</span>
            <select
              value={selectedClient}
              onChange={(event) => setSelectedClient(event.target.value)}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All</option>
              {clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Property</span>
            <select
              value={selectedProperty}
              onChange={(event) => setSelectedProperty(event.target.value)}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All</option>
              {properties.map((property) => (
                <option key={property} value={property}>
                  {property}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Year</span>
            <select
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(event.target.value === "" ? "" : Number.parseInt(event.target.value, 10))
              }
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">Week</span>
            <select
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(event.target.value)}
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All</option>
              {weeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {sorted.map((photo) => {
          const signedUrl = signedUrls[photo.photoPath];
          const preference = describePreference(preferenceLookup, photo);
          const binList = normalizeBins(photo.bins);

          const shouldShowOddButton = photo.weekParity === "odd" || photo.weekParity === null;
          const shouldShowEvenButton = photo.weekParity === "even" || photo.weekParity === null;

          return (
            <article
              key={photo.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-gray-900">{photo.address ?? "Property"}</p>
                <p className="text-xs text-gray-600">{photo.clientName ?? "Client"}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                  <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-800">
                    {photo.taskType === "put_out" ? "Put out" : "Bring in"}
                  </span>
                  {photo.weekLabel && (
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-800">
                      {photo.weekLabel} {photo.weekParity ? `(${photo.weekParity} week)` : ""}
                    </span>
                  )}
                  {photo.year && (
                    <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-800">{photo.year}</span>
                  )}
                </div>
              </div>

              {signedUrl ? (
                <img
                  src={signedUrl}
                  alt={`Proof for ${photo.address ?? "property"}`}
                  className="aspect-[3/4] w-full rounded-xl bg-gray-50 object-contain shadow-inner"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-600">
                  Loading preview…
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-800">
                  {formatDate(photo.completedOn) || "Date unknown"}
                </span>
                {photo.propertyId ? (
                  <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-800">Linked</span>
                ) : (
                  <span className="rounded-full bg-yellow-100 px-2 py-1 font-medium text-yellow-800">
                    No property link
                  </span>
                )}
                {preference.matchesOdd && (
                  <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800">
                    Odd week proof
                  </span>
                )}
                {preference.matchesEven && (
                  <span className="rounded-full bg-purple-100 px-2 py-1 font-medium text-purple-800">
                    Even week proof
                  </span>
                )}
              </div>

              {binList.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                  <span className="font-semibold text-gray-900">
                    {photo.taskType === "put_out" ? "Bins to put out:" : "Bins to bring in:"}
                  </span>
                  {binList.map((bin) => renderBinChip(bin))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {shouldShowOddButton && (
                  <button
                    type="button"
                    disabled={savingPreferenceFor === photo.id}
                    onClick={() => handlePreference(photo, "odd")}
                    className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPreferenceFor === photo.id ? "Saving…" : "Use for odd weeks"}
                  </button>
                )}
                {shouldShowEvenButton && (
                  <button
                    type="button"
                    disabled={savingPreferenceFor === photo.id}
                    onClick={() => handlePreference(photo, "even")}
                    className="inline-flex items-center justify-center rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800 transition hover:border-purple-300 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPreferenceFor === photo.id ? "Saving…" : "Use for even weeks"}
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {sorted.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-700">
            No photos found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
