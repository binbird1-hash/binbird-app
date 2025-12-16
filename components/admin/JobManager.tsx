"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { JobRecord } from "@/lib/database.types";

const DAY_OPTIONS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const sortJobs = (entries: JobRecord[]) => {
  return [...entries].sort((a, b) => {
    const dayA = a.day_of_week ?? "";
    const dayB = b.day_of_week ?? "";
    if (dayA !== dayB) {
      return dayA.localeCompare(dayB);
    }
    const addressA = a.address ?? "";
    const addressB = b.address ?? "";
    return addressA.localeCompare(addressB);
  });
};

type StaffMember = {
  id: string;
  name: string;
  role: string | null;
};

type JobFormState = {
  account_id: string;
  property_id: string;
  address: string;
  client_name: string;
  job_type: string;
  bins: string;
  notes: string;
  assigned_to: string;
  day_of_week: string;
  lat: string;
  lng: string;
  last_completed_on: string;
  photo_path: string;
};

type JobFieldType = "text" | "textarea" | "number" | "date" | "jobType" | "assignee" | "day";

type JobFieldConfig = {
  key: keyof JobFormState;
  label: string;
  type?: JobFieldType;
};

const JOB_FIELD_CONFIGS: JobFieldConfig[] = [
  { key: "account_id", label: "Account ID" },
  { key: "property_id", label: "Property ID" },
  { key: "address", label: "Address" },
  { key: "client_name", label: "Client Name" },
  { key: "job_type", label: "Job Type", type: "jobType" },
  { key: "bins", label: "Bins" },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "assigned_to", label: "Assigned To", type: "assignee" },
  { key: "day_of_week", label: "Day of Week", type: "day" },
  { key: "lat", label: "Latitude", type: "number" },
  { key: "lng", label: "Longitude", type: "number" },
  { key: "last_completed_on", label: "Last Completed On", type: "date" },
  { key: "photo_path", label: "Photo Path" },
];

const createEmptyJobState = (): JobFormState => ({
  account_id: "",
  property_id: "",
  address: "",
  client_name: "",
  job_type: "put_out",
  bins: "",
  notes: "",
  assigned_to: "",
  day_of_week: "",
  lat: "",
  lng: "",
  last_completed_on: "",
  photo_path: "",
});

const parseCoordinate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const editableJobFields = JOB_FIELD_CONFIGS.filter(
  (field) => field.key !== "account_id" && field.key !== "property_id",
);

const buildJobPayload = (state: JobFormState) => {
  const jobType = state.job_type === "bring_in" ? "bring_in" : "put_out";
  const address = state.address.trim();

  return {
    account_id: state.account_id.trim().length ? state.account_id.trim() : null,
    property_id: state.property_id.trim().length ? state.property_id.trim() : null,
    address,
    client_name: state.client_name.trim().length ? state.client_name.trim() : null,
    job_type: jobType,
    bins: state.bins.trim().length ? state.bins.trim() : null,
    notes: state.notes.trim().length ? state.notes.trim() : null,
    assigned_to: state.assigned_to.trim().length ? state.assigned_to.trim() : null,
    day_of_week: state.day_of_week.trim().length ? state.day_of_week.trim() : null,
    lat: parseCoordinate(state.lat),
    lng: parseCoordinate(state.lng),
    last_completed_on: state.last_completed_on.trim().length ? state.last_completed_on.trim() : null,
    photo_path: state.photo_path.trim().length ? state.photo_path.trim() : null,
  };
};

export default function JobManager() {
  const supabase = useSupabase();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<JobFormState>(createEmptyJobState());
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [jobsResult, staffResult] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, status, started_at, arrived_at, completed_at, last_completed_on, assigned_to, day_of_week",
        )
        .order("day_of_week", { ascending: true })
        .order("address", { ascending: true }),
      supabase
        .from("user_profile")
        .select("user_id, full_name, role")
        .in("role", ["staff", "admin"]),
    ]);

    if (jobsResult.error) {
      console.warn("Failed to load jobs", jobsResult.error);
      setJobs([]);
    } else {
      setJobs(sortJobs((jobsResult.data ?? []) as JobRecord[]));
    }

    if (staffResult.error) {
      console.warn("Failed to load staff", staffResult.error);
      setStaff([]);
    } else {
      setStaff(
        (staffResult.data ?? []).map((row) => ({
          id: row.user_id,
          name: row.full_name?.trim().length ? row.full_name : row.user_id,
          role: row.role ?? null,
        })),
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredJobs = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (dayFilter && job.day_of_week?.toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }
      if (!trimmedSearch.length) return true;
      const haystack = [
        job.address,
        job.client_name,
        job.account_id,
        job.property_id,
        job.assigned_to,
      ]
        .map((value) => value?.toString().toLowerCase() ?? "")
        .join(" ");
      return haystack.includes(trimmedSearch);
    });
  }, [jobs, dayFilter, search]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const selectJob = (job: JobRecord) => {
    setIsCreating(false);
    setSelectedJobId(job.id);
    setFormState({
      account_id: job.account_id ?? "",
      property_id: job.property_id ?? "",
      address: job.address ?? "",
      client_name: job.client_name ?? "",
      job_type: job.job_type ?? "put_out",
      bins: job.bins ?? "",
      notes: job.notes ?? "",
      assigned_to: job.assigned_to ?? "",
      day_of_week: job.day_of_week ?? "",
      lat: job.lat !== null && job.lat !== undefined ? String(job.lat) : "",
      lng: job.lng !== null && job.lng !== undefined ? String(job.lng) : "",
      last_completed_on: job.last_completed_on ?? "",
      photo_path: job.photo_path ?? "",
    });
    setStatus(null);
  };

  const startCreate = () => {
    setIsCreating(true);
    setSelectedJobId(null);
    setFormState(createEmptyJobState());
    setStatus(null);
  };

  const handleInputChange = (key: keyof JobFormState, value: string) => {
    setFormState((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const payload = buildJobPayload(formState);
      if (!payload.address || typeof payload.address !== "string" || !payload.address.trim().length) {
        setStatus({ type: "error", message: "An address is required." });
        setSaving(false);
        return;
      }

      if (isCreating) {
        const { data, error } = await supabase
          .from("jobs")
          .insert(payload)
          .select(
            "id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, last_completed_on, assigned_to, day_of_week",
          )
          .maybeSingle<JobRecord>();

        if (error) {
          setStatus({ type: "error", message: error.message });
          setSaving(false);
          return;
        }

        if (data) {
          setJobs((current) => sortJobs([...current, data]));
          setIsCreating(false);
          setSelectedJobId(data.id);
          selectJob(data);
          setStatus({ type: "success", message: "Job created." });
        }
      } else if (selectedJobId) {
        const { data, error } = await supabase
          .from("jobs")
          .update(payload)
          .eq("id", selectedJobId)
          .select(
            "id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, last_completed_on, assigned_to, day_of_week",
          )
          .maybeSingle<JobRecord>();

        if (error) {
          setStatus({ type: "error", message: error.message });
          setSaving(false);
          return;
        }

        if (data) {
          setJobs((current) => sortJobs(current.map((job) => (job.id === selectedJobId ? data : job))));
          setSelectedJobId(data.id);
          selectJob(data);
          setStatus({ type: "success", message: "Job updated." });
        }
      }
    } catch (saveError) {
      console.error("Failed to save job", saveError);
      setStatus({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "Unable to save the job. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const jobId = isCreating ? null : selectedJobId;
    if (!jobId) {
      setStatus({ type: "error", message: "Select a job to delete." });
      return;
    }
    const confirmed = window.confirm("Delete this job? This action cannot be undone.");
    if (!confirmed) return;
    setDeleting(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) {
        setStatus({ type: "error", message: error.message });
        setDeleting(false);
        return;
      }
      setJobs((current) => current.filter((job) => job.id !== jobId));
      setSelectedJobId(null);
      setFormState(createEmptyJobState());
      setIsCreating(false);
      setStatus({ type: "success", message: "Job deleted." });
    } catch (deleteError) {
      console.error("Failed to delete job", deleteError);
      setStatus({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete the job. Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Jobs & Assignments</h2>
              <p className="text-sm text-gray-700">
                Assign staff, edit job details, and keep the schedule aligned with current client needs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                New job
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex w-full flex-col text-sm text-gray-900 sm:w-auto">
              <span className="font-medium text-gray-800">Filter by day</span>
              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">All days</option>
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-full flex-col text-sm text-gray-900 sm:w-auto">
              <span className="font-medium text-gray-800">Search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search address, client, or property"
                className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <p className="p-4 text-sm text-gray-700">Loading jobs…</p>
            ) : filteredJobs.length === 0 ? (
              <p className="p-4 text-sm text-gray-700">No jobs match the current filters.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left">Job</th>
                    <th className="px-4 py-3 text-left">Assignee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredJobs.map((job) => {
                    const isSelected = job.id === selectedJobId && !isCreating;
                    const assignee = staff.find((member) => member.id === job.assigned_to);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => selectJob(job)}
                        className={`cursor-pointer transition hover:bg-gray-100 ${
                          isSelected ? "bg-gray-100" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-semibold text-gray-900">{job.address ?? "Address"}</div>
                          <div className="text-xs text-gray-600">{job.day_of_week ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {job.job_type === "bring_in" ? "Bring in" : "Put out"}
                          {job.bins ? <span className="ml-2 text-xs text-gray-600">{job.bins}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {assignee ? assignee.name : job.assigned_to ? job.assigned_to : "Unassigned"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isCreating ? "Create job" : selectedJob ? "Edit job" : "Select a job"}
              </h3>
              <p className="text-xs text-gray-600">
                {isCreating
                  ? "Fill in the details below to create a new job."
                  : selectedJob
                  ? "Update job details and assignments, then save your changes."
                  : "Select a job from the list to edit its details."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || (!selectedJobId && !isCreating)}
              className="rounded-lg border border-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>

          {status && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                status.type === "success"
                  ? "border border-green-300 bg-green-50 text-green-800"
                  : "border border-red-300 bg-red-50 text-red-800"
              }`}
            >
              {status.message}
            </div>
          )}

          {(isCreating || selectedJob) && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {editableJobFields.map((field) => {
                  const value = formState[field.key] ?? "";
                  const commonProps = {
                    id: `job-${field.key}`,
                    value,
                    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                      handleInputChange(field.key, event.target.value),
                    className:
                      "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300",
                  } as const;

                  return (
                    <label key={field.key} className="flex flex-col text-sm text-gray-900">
                      <span className="font-medium text-gray-800">{field.label}</span>
                      {field.type === "textarea" ? (
                        <textarea rows={4} {...commonProps} />
                      ) : field.type === "number" ? (
                        <input type="number" step="any" {...commonProps} />
                      ) : field.type === "date" ? (
                        <input type="date" {...commonProps} />
                      ) : field.type === "jobType" ? (
                        <select {...commonProps}>
                          <option value="put_out">Put out</option>
                          <option value="bring_in">Bring in</option>
                        </select>
                      ) : field.type === "assignee" ? (
                        <select {...commonProps}>
                          <option value="">Unassigned</option>
                          {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "day" ? (
                        <select {...commonProps}>
                          <option value="">Not set</option>
                          {DAY_OPTIONS.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                        ) : (
                          <input type="text" {...commonProps} />
                        )}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : isCreating ? "Create job" : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {!isCreating && !selectedJob && (
            <p className="text-sm text-slate-300">Select a job from the list or create a new job to manage its details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
