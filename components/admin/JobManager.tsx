"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import type { JobRecord } from "@/lib/database.types";

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const BIN_COLORS = ["Red", "Yellow", "Green"] as const;

const sortJobs = (entries: JobRecord[]) => {
  const getDayIndex = (day: string | null | undefined) => {
    const value = day?.toLowerCase().trim();
    const idx = DAY_OPTIONS.findIndex((option) => option.toLowerCase() === value);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  return [...entries].sort((a, b) => {
    const dayA = a.day_of_week ?? "";
    const dayB = b.day_of_week ?? "";
    const dayOrderA = getDayIndex(dayA);
    const dayOrderB = getDayIndex(dayB);
    if (dayOrderA !== dayOrderB) {
      return dayOrderA - dayOrderB;
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

type ClientProperty = {
  property_id: string;
  account_id: string | null;
  address: string | null;
  client_name: string | null;
  photo_path: string | null;
  lat_lng: string | null;
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

type BinColor = (typeof BIN_COLORS)[number];

type JobFieldType = "text" | "textarea" | "number" | "date" | "jobType" | "assignee" | "day" | "bins";

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
  { key: "bins", label: "Bins", type: "bins" },
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

const parseLatLngString = (value: string | null | undefined) => {
  if (!value) return { lat: "", lng: "" };
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const [lat = "", lng = ""] = parts;
  return { lat, lng };
};

const parseBinsFromString = (value: string | null | undefined): BinColor[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((color) => {
      const lower = color.toLowerCase();
      if (lower.startsWith("red")) return "Red" as const;
      if (lower.startsWith("yellow")) return "Yellow" as const;
      if (lower.startsWith("green")) return "Green" as const;
      return null;
    })
    .filter(Boolean) as BinColor[];
};

const formatBinsValue = (colors: Iterable<BinColor>) => {
  const ordered = Array.from(new Set(colors));
  return ordered.join(", ");
};

const buildJobPayload = (state: JobFormState) => {
  const jobType = state.job_type === "bring_in" ? "bring_in" : "put_out";
  const address = state.address.trim();
  const bins = formatBinsValue(parseBinsFromString(state.bins));

  return {
    account_id: state.account_id.trim().length ? state.account_id.trim() : null,
    property_id: state.property_id.trim().length ? state.property_id.trim() : null,
    address,
    client_name: state.client_name.trim().length ? state.client_name.trim() : null,
    job_type: jobType,
    bins: bins.length ? bins : null,
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
  const [properties, setProperties] = useState<ClientProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<JobFormState>(createEmptyJobState());
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dayFilter, setDayFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [jobsResult, staffResult, propertyResult] = await Promise.all([
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
      supabase
        .from("client_list")
        .select("property_id, account_id, address, client_name, photo_path, lat_lng")
        .order("address", { ascending: true }),
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

    if (propertyResult.error) {
      console.warn("Failed to load properties", propertyResult.error);
      setProperties([]);
    } else {
      setProperties(propertyResult.data as ClientProperty[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member.name] as const)), [staff]);
  const propertiesById = useMemo(
    () => new Map(properties.map((property) => [property.property_id, property] as const)),
    [properties],
  );

  const selectedBins = useMemo(() => new Set(parseBinsFromString(formState.bins)), [formState.bins]);

  const filteredJobs = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (dayFilter && job.day_of_week?.toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }
      if (!trimmedSearch.length) return true;
      const assignedName = job.assigned_to ? staffById.get(job.assigned_to) ?? "" : "";
      const haystack = [
        job.address,
        job.client_name,
        job.account_id,
        job.property_id,
        assignedName,
        job.assigned_to,
      ]
        .map((value) => value?.toString().toLowerCase() ?? "")
        .filter(Boolean);

      if (!job.assigned_to && "unassigned".includes(trimmedSearch)) {
        haystack.push("unassigned");
      }

      return haystack.some((value) => value.includes(trimmedSearch));
    });
  }, [jobs, dayFilter, search, staffById]);

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

  const closeCreate = () => {
    setIsCreating(false);
    setFormState(createEmptyJobState());
    setStatus(null);
  };

  const handleInputChange = (key: keyof JobFormState, value: string) => {
    setFormState((previous) => ({ ...previous, [key]: value }));
  };

  const handlePropertySelect = (propertyId: string) => {
    const property = propertiesById.get(propertyId);
    const { lat, lng } = parseLatLngString(property?.lat_lng ?? "");

    setFormState((previous) => ({
      ...previous,
      property_id: propertyId,
      account_id: property?.account_id ?? "",
      address: property?.address ?? "",
      client_name: property?.client_name ?? "",
      photo_path: property?.photo_path ?? "",
      lat,
      lng,
    }));
  };

  const updateBinSelection = (color: BinColor, checked: boolean) => {
    setFormState((previous) => {
      const current = new Set(parseBinsFromString(previous.bins));
      if (checked) {
        current.add(color);
      } else {
        current.delete(color);
      }
      return { ...previous, bins: formatBinsValue(current) };
    });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      if (isCreating && !formState.property_id.trim().length) {
        setStatus({ type: "error", message: "Select a property address before creating a job." });
        setSaving(false);
        return;
      }

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
      return false;
    }

    setDeleting(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) {
        setStatus({ type: "error", message: error.message });
        return false;
      }
      setJobs((current) => current.filter((job) => job.id !== jobId));
      setSelectedJobId(null);
      setFormState(createEmptyJobState());
      setIsCreating(false);
      setStatus({ type: "success", message: "Job deleted." });
      return true;
    } catch (deleteError) {
      console.error("Failed to delete job", deleteError);
      setStatus({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete the job. Please try again.",
      });
      return false;
    } finally {
      setDeleting(false);
    }
  };

  const sortedProperties = useMemo(
    () => [...properties].sort((a, b) => (a.address ?? "").localeCompare(b.address ?? "")),
    [properties],
  );

  const getFieldConfig = (key: keyof JobFormState) => JOB_FIELD_CONFIGS.find((field) => field.key === key);

  const baseInputClasses =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300";
  const selectClasses = `${baseInputClasses} pr-10`;

  const renderTextField = (key: keyof JobFormState, className: string) => {
    const config = getFieldConfig(key);
    const value = formState[key] ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? key}</span>
        <input
          type="text"
          id={`job-${key}`}
          value={value}
          onChange={(event) => handleInputChange(key, event.target.value)}
          className={className}
        />
      </label>
    );
  };

  const renderNumberField = (key: keyof JobFormState, className: string) => {
    const config = getFieldConfig(key);
    const value = formState[key] ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? key}</span>
        <input
          type="text"
          inputMode="decimal"
          id={`job-${key}`}
          value={value}
          onChange={(event) => handleInputChange(key, event.target.value)}
          className={className}
        />
      </label>
    );
  };

  const renderDateField = (key: keyof JobFormState, className: string) => {
    const config = getFieldConfig(key);
    const value = formState[key] ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? key}</span>
        <input
          type="date"
          id={`job-${key}`}
          value={value}
          onChange={(event) => handleInputChange(key, event.target.value)}
          className={className}
        />
      </label>
    );
  };

  const renderSelectField = (key: "assigned_to", className: string) => {
    const config = getFieldConfig(key);
    const value = formState[key] ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? key}</span>
        <select
          id={`job-${key}`}
          value={value}
          onChange={(event) => handleInputChange(key, event.target.value)}
          className={className}
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
          {value && !staffById.has(value) ? <option value={value}>Assignee not found</option> : null}
        </select>
      </label>
    );
  };

  const renderDayField = (className: string) => {
    const config = getFieldConfig("day_of_week");
    const value = formState.day_of_week ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? "Day of Week"}</span>
        <select
          id="job-day_of_week"
          value={value}
          onChange={(event) => handleInputChange("day_of_week", event.target.value)}
          className={className}
        >
          <option value="">Not set</option>
          {DAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const renderJobTypeField = (className: string) => {
    const config = getFieldConfig("job_type");
    const value = formState.job_type ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? "Job Type"}</span>
        <select
          id="job-job_type"
          value={value}
          onChange={(event) => handleInputChange("job_type", event.target.value)}
          className={className}
        >
          <option value="put_out">Put out</option>
          <option value="bring_in">Bring in</option>
        </select>
      </label>
    );
  };

  const renderNotesField = (className: string) => {
    const config = getFieldConfig("notes");
    const value = formState.notes ?? "";
    return (
      <label className="flex flex-col text-sm text-gray-900">
        <span className="font-medium text-gray-800">{config?.label ?? "Notes"}</span>
        <textarea
          id="job-notes"
          rows={2}
          value={value}
          onChange={(event) => handleInputChange("notes", event.target.value)}
          className={`${className} min-h-[44px]`}
        />
      </label>
    );
  };

  const renderBinSelector = () => (
    <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2">
      <span className="text-sm font-medium text-gray-800">Bin colors</span>
      <div className="flex items-center gap-4 text-sm font-semibold">
        {BIN_COLORS.map((color) => (
          <label key={color} className="flex items-center justify-start gap-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={selectedBins.has(color)}
              onChange={(event) => updateBinSelection(color, event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span className="text-gray-900">{color}</span>
          </label>
        ))}
      </div>
    </div>
  );

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

          <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <label className="flex w-full flex-col text-sm text-gray-900 sm:col-span-3">
              <span className="font-medium text-gray-800">Search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by address or client"
                className={baseInputClasses}
              />
            </label>
            <label className="flex w-full flex-col text-sm text-gray-900 sm:col-span-1">
              <span className="font-medium text-gray-800">Filter by day</span>
              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className={selectClasses}
              >
                <option value="">All days</option>
                {DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <p className="p-4 text-sm text-gray-700">Loading jobs…</p>
            ) : filteredJobs.length === 0 ? (
              <p className="p-4 text-sm text-gray-700">No jobs match the current filters.</p>
            ) : (
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left">Day</th>
                    <th className="px-4 py-3 text-left">Job</th>
                    <th className="px-4 py-3 text-left">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredJobs.map((job) => {
                    const isSelected = job.id === selectedJobId && !isCreating;
                    const assigneeName = job.assigned_to ? staffById.get(job.assigned_to) : null;
                    return (
                      <tr
                        key={job.id}
                        onClick={() => selectJob(job)}
                        className={`cursor-pointer transition hover:bg-gray-100 ${
                          isSelected ? "bg-gray-100" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 align-middle text-sm text-gray-900">
                          <div
                            className="font-semibold text-gray-900 whitespace-nowrap truncate"
                            title={job.address ?? undefined}
                          >
                            {job.address ?? "Address"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700 whitespace-nowrap">
                          {job.day_of_week ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700">
                          <div className="flex h-full items-center gap-1 whitespace-nowrap text-left font-semibold text-gray-900">
                            {job.job_type === "bring_in" ? "Bring in" : "Put out"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700">
                          <div
                            className="whitespace-nowrap truncate text-sm font-medium text-gray-900"
                            title={assigneeName ?? job.assigned_to ?? undefined}
                          >
                            {assigneeName ?? (job.assigned_to ? "Assignee not found" : "Unassigned")}
                          </div>
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
                {selectedJob ? "Edit job" : "Select a job"}
              </h3>
              <p className="text-xs text-gray-600">
                {selectedJob
                  ? "Update job details and assignments, then save your changes."
                  : "Select a job from the list to edit its details."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting || !selectedJobId || isCreating}
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

          {selectedJob && !isCreating && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  {renderTextField("address", baseInputClasses)}
                  {renderSelectField("assigned_to", selectClasses)}
                </div>

                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  {renderJobTypeField(selectClasses)}
                  {renderDayField(selectClasses)}
                </div>

                <div className="sm:col-span-2">{renderBinSelector()}</div>

                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  {renderNumberField("lat", baseInputClasses)}
                  {renderNumberField("lng", baseInputClasses)}
                </div>

                <div className="sm:col-span-2">{renderTextField("photo_path", baseInputClasses)}</div>

                <div className="sm:col-span-2">{renderNotesField(baseInputClasses)}</div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {!isCreating && !selectedJob && (
            <p className="text-sm text-slate-300">Select a job from the list or create a new job to manage its details.</p>
          )}
        </div>
      </div>

      {isCreating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create job</h3>
                <p className="text-xs text-gray-600">Fill in the details to create a new job.</p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="text-lg font-semibold text-gray-600 transition hover:text-gray-900"
                aria-label="Close create job"
              >
                ×
              </button>
            </div>

            {status && (
              <div
                className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                  status.type === "success"
                    ? "border border-green-300 bg-green-50 text-green-800"
                    : "border border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {status.message}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm text-gray-900">
                    <span className="font-medium text-gray-800">Property address</span>
                    <select
                      value={formState.property_id}
                      onChange={(event) => handlePropertySelect(event.target.value)}
                      className={selectClasses}
                    >
                      <option value="">Select a property</option>
                      {sortedProperties.map((property) => (
                        <option key={property.property_id} value={property.property_id}>
                          {property.address ?? "Address"}
                          {property.client_name ? ` — ${property.client_name}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {renderSelectField("assigned_to", selectClasses)}
                </div>

                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  {renderJobTypeField(selectClasses)}
                  {renderDayField(selectClasses)}
                </div>

                <div className="sm:col-span-2">{renderBinSelector()}</div>

                <div className="sm:col-span-2">{renderNotesField(baseInputClasses)}</div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Create job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete job"
        description="Are you sure you want to delete this job? This action cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete job"}
        onCancel={() => {
          if (!deleting) setShowDeleteConfirm(false);
        }}
        onConfirm={async () => {
          await handleDelete();
          setShowDeleteConfirm(false);
        }}
        loading={deleting}
        destructive
      />
    </div>
  );
}
