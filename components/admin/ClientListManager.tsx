"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import ConfirmDialog from "./ConfirmDialog";
import NewClientForm from "./NewClientForm";
import {
  CLIENT_DATE_FIELD_KEYS,
  CLIENT_FIELD_CONFIGS,
  CLIENT_NUMBER_FIELD_KEYS,
  type ClientListRow,
} from "./clientFieldConfig";
import { getBinSchedule } from "@/lib/binSchedule";

type StaffMember = {
  id: string;
  name: string;
  role: string | null;
};

type ClientFormState = Record<keyof ClientListRow, string>;

const numberFields = new Set(CLIENT_NUMBER_FIELD_KEYS);
const dateFields = new Set(CLIENT_DATE_FIELD_KEYS);
const editableClientFields = CLIENT_FIELD_CONFIGS.filter(
  (field) => field.key !== "property_id" && field.key !== "account_id",
);
const fullWidthFields = new Set<keyof ClientListRow>(["address", "photo_path", "notes"]);
const binCountKeys = new Set<keyof ClientListRow>(["red_bins", "yellow_bins", "green_bins"]);
const binFrequencyOptions = ["Weekly", "Fortnightly"] as const;
type BinGroupKey =
  | "red_freq"
  | "red_flip"
  | "red_bins"
  | "yellow_freq"
  | "yellow_flip"
  | "yellow_bins"
  | "green_freq"
  | "green_flip"
  | "green_bins";

const binGroupKeys = new Set<BinGroupKey>([
  "red_freq",
  "red_flip",
  "red_bins",
  "yellow_freq",
  "yellow_flip",
  "yellow_bins",
  "green_freq",
  "green_flip",
  "green_bins",
]);

const isBinGroupKey = (key: keyof ClientListRow): key is BinGroupKey =>
  binGroupKeys.has(key as BinGroupKey);

const defaultBinCount = "1";

const sanitiseBinCount = (value: unknown): string => {
  if (value === null || value === undefined) return defaultBinCount;
  const trimmed = String(value).trim();
  if (!trimmed.length) return defaultBinCount;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return defaultBinCount;
  return String(Math.max(0, parsed));
};

const toFormState = (row: ClientListRow): ClientFormState => {
  const state = {} as ClientFormState;
  (Object.keys(row) as Array<keyof ClientListRow>).forEach((key) => {
    const value = row[key];
    if (binCountKeys.has(key)) {
      state[key] = sanitiseBinCount(value);
    } else {
      state[key] = value === null || value === undefined ? "" : String(value);
    }
  });
  return state;
};

const emptyFormState = (): ClientFormState => {
  const state = {} as ClientFormState;
  CLIENT_FIELD_CONFIGS.forEach(({ key }) => {
    state[key] = binCountKeys.has(key) ? defaultBinCount : "";
  });
  return state;
};

const normaliseSearch = (value: string) => value.toLowerCase().trim();

const parseNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function ClientListManager() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<ClientListRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [sortField, setSortField] = useState<"" | "put_bins_out" | "collection_day">("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(emptyFormState);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingJobs, setCreatingJobs] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const baseInputClasses =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300";
  const selectClasses = `${baseInputClasses} pr-12`;

  const loadRows = useCallback(async () => {
    setLoading(true);
    const [clientsResult, staffResult] = await Promise.all([
      supabase
        .from("client_list")
        .select(
          "property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, red_freq, red_flip, red_bins, yellow_freq, yellow_flip, yellow_bins, green_freq, green_flip, green_bins, email, assigned_to, lat_lng, price_per_month, photo_path, trial_start, membership_start",
        )
        .order("client_name", { ascending: true }),
      supabase
        .from("user_profile")
        .select("user_id, full_name, role")
        .in("role", ["staff", "admin"]),
    ]);

    if (clientsResult.error) {
      console.warn("Failed to load client list", clientsResult.error);
      setRows([]);
      setStatus({ type: "error", message: "Unable to load client records." });
    } else {
      setRows((clientsResult.data ?? []) as ClientListRow[]);
    }

    if (staffResult.error) {
      console.warn("Failed to load staff", staffResult.error);
      setStaff([]);
    } else {
      setStaff(
        (staffResult.data ?? []).map((row) => ({
          id: row.user_id,
          name: row.full_name?.trim().length ? row.full_name : "Team member",
          role: row.role ?? null,
        })),
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const staffById = useMemo(() => {
    const entries = staff.map((member) => [member.id, member.name] as const);
    return new Map(entries);
  }, [staff]);
  const binSchedule = useMemo(
    () =>
      getBinSchedule({
        red_freq: formState.red_freq,
        red_flip: formState.red_flip,
        yellow_freq: formState.yellow_freq,
        yellow_flip: formState.yellow_flip,
        green_freq: formState.green_freq,
        green_flip: formState.green_flip,
      }),
    [
      formState.green_flip,
      formState.green_freq,
      formState.red_flip,
      formState.red_freq,
      formState.yellow_flip,
      formState.yellow_freq,
    ],
  );

  const filteredRows = useMemo(() => {
    const query = normaliseSearch(search);
    const filteredBySearch = rows.filter((row) => {
      const assignedName = row.assigned_to ? staffById.get(row.assigned_to) ?? "" : "";
      const haystack = [
        row.client_name,
        row.company,
        row.address,
        row.email,
        assignedName,
        row.assigned_to,
        row.assigned_to ? "" : "unassigned",
      ]
        .map((value) => value?.toString().toLowerCase() ?? "")
        .join(" ");
      return !query.length || haystack.includes(query);
    });

    const filteredByAssignee = filteredBySearch.filter((row) => {
      if (!assignedFilter.length) return true;
      if (assignedFilter === "__unassigned__") return !row.assigned_to;
      return row.assigned_to === assignedFilter;
    });

    if (!sortField) {
      return filteredByAssignee;
    }

    const getDayIndex = (value: string | null) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const index = daysOfWeek.findIndex((day) => day.toLowerCase() === value.toLowerCase());
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    };

    return [...filteredByAssignee].sort((a, b) => {
      const aIndex = getDayIndex(a[sortField]);
      const bIndex = getDayIndex(b[sortField]);
      return aIndex - bIndex;
    });
  }, [assignedFilter, rows, search, sortField, staffById]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.property_id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  const handleSelectRow = (row: ClientListRow) => {
    setSelectedRowId(row.property_id);
    setFormState(toFormState(row));
    setStatus(null);
  };

  const handleInputChange = (key: keyof ClientListRow, value: string) => {
    let nextValue = value;

    if (binCountKeys.has(key)) {
      const trimmed = value.trim();
      if (!trimmed.length) {
        nextValue = "";
      } else {
        const parsed = Number(trimmed);
        nextValue = Number.isFinite(parsed) ? String(Math.max(0, parsed)) : "";
      }
    }

    setFormState((previous) => ({ ...previous, [key]: nextValue }));
  };

  const buildPayload = (state: ClientFormState) => {
    const payload: Record<string, unknown> = {};

    (Object.keys(state) as Array<keyof ClientListRow>).forEach((key) => {
      const value = state[key];
      if (numberFields.has(key)) {
        payload[key] = parseNumberInput(value);
      } else if (dateFields.has(key)) {
        payload[key] = value.trim().length ? value.trim() : null;
      } else if (key === "property_id") {
        payload[key] = value.trim();
      } else if (key === "account_id") {
        payload[key] = value.trim().length ? value.trim() : null;
      } else {
        payload[key] = value.trim().length ? value.trim() : null;
      }
    });

    return payload;
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRowId) return false;
    setSaving(true);
    setStatus(null);
    try {
      const payload = buildPayload(formState);
      if (!payload.property_id || typeof payload.property_id !== "string" || !payload.property_id.trim().length) {
        setStatus({ type: "error", message: "Property ID is required." });
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("client_list")
        .update(payload)
        .eq("property_id", selectedRowId)
        .select(
          "property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, red_freq, red_flip, red_bins, yellow_freq, yellow_flip, yellow_bins, green_freq, green_flip, green_bins, email, assigned_to, lat_lng, price_per_month, photo_path, trial_start, membership_start",
        )
        .maybeSingle<ClientListRow>();

      if (error) {
        setStatus({ type: "error", message: error.message });
        setSaving(false);
        return;
      }

      if (!data) {
        setStatus({ type: "error", message: "Client record was not updated." });
        setSaving(false);
        return;
      }

      setRows((current) =>
        current.map((row) => (row.property_id === selectedRowId ? (data as ClientListRow) : row)),
      );
      setSelectedRowId(data.property_id);
      setFormState(toFormState(data as ClientListRow));
      setStatus({ type: "success", message: "Client record updated." });
    } catch (saveError) {
      console.error("Failed to update client", saveError);
      setStatus({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "Unable to update the client. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderBinGroup = (prefix: "red" | "yellow" | "green") => {
    const freqKey = `${prefix}_freq` as keyof ClientListRow;
    const binsKey = `${prefix}_bins` as keyof ClientListRow;
    const flipKey = `${prefix}_flip` as keyof ClientListRow;
    const freqValue = formState[freqKey] ?? "";
    const binsValue = formState[binsKey] ?? "";
    const flipValue = formState[flipKey] ?? "";
    const scheduledThisWeek = binSchedule.status[prefix];

    return (
      <div key={`${prefix}-bin-group`} className="sm:col-span-2 lg:col-span-3">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">{`${prefix[0].toUpperCase()}${prefix.slice(1)} Bin Frequency`}</span>
            <select
              id={`client-${freqKey}`}
              value={freqValue}
              onChange={(event) => handleInputChange(freqKey, event.target.value)}
              className={selectClasses}
            >
              <option value="">Select a frequency</option>
              {binFrequencyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">{`${prefix[0].toUpperCase()}${prefix.slice(1)} Bins`}</span>
            <input
              id={`client-${binsKey}`}
              type="number"
              min={0}
              step="any"
              value={binsValue}
              onChange={(event) => handleInputChange(binsKey, event.target.value)}
              className={baseInputClasses}
            />
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">{`${prefix[0].toUpperCase()}${prefix.slice(1)} Flip`}</span>
            <div className="mt-1 flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800">
              <input
                id={`client-${flipKey}`}
                type="checkbox"
                checked={flipValue === "Yes"}
                onChange={(event) => handleInputChange(flipKey, event.target.checked ? "Yes" : "")}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              <span className="text-sm">Yes</span>
            </div>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {freqValue
            ? scheduledThisWeek
              ? "Scheduled this week based on the current flip setting."
              : "Off-week this week with the current selections."
            : "Choose a frequency to preview this week's schedule."}
        </p>
      </div>
    );
  };

  const renderSingleField = (field: (typeof CLIENT_FIELD_CONFIGS)[number]) => {
    const value = formState[field.key] ?? "";
    const isFullWidth = fullWidthFields.has(field.key);

    const commonProps = {
      id: `client-${field.key as string}`,
      value,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleInputChange(field.key, event.target.value),
      className: baseInputClasses,
    } as const;

    return (
      <label
        key={field.key as string}
        className={`flex flex-col text-sm text-gray-900 ${isFullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}
      >
        <span className="font-medium text-gray-800">{field.label}</span>
        {field.key === "collection_day" || field.key === "put_bins_out" ? (
          <select {...commonProps} className={selectClasses}>
            <option value="">Select a day</option>
            {daysOfWeek.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        ) : field.type === "bin-frequency" ? (
          <select {...commonProps} className={selectClasses}>
            <option value="">Select a frequency</option>
            {binFrequencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "flip" ? (
          <div className="mt-1 flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800">
            <input
              id={`client-${field.key as string}`}
              type="checkbox"
              checked={value === "Yes"}
              onChange={(event) => handleInputChange(field.key, event.target.checked ? "Yes" : "")}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
            />
            <span className="text-sm">Yes</span>
          </div>
        ) : field.type === "textarea" ? (
          <textarea rows={2} {...commonProps} className={`${commonProps.className} min-h-[44px]`} />
        ) : field.key === "price_per_month" ? (
          <input type="text" inputMode="decimal" {...commonProps} />
        ) : field.type === "number" ? (
          <input type="number" step="any" {...commonProps} />
        ) : field.type === "date" ? (
          <input type="date" {...commonProps} />
        ) : field.type === "assignee" ? (
          <select {...commonProps} className={selectClasses}>
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
            {value && !staffById.has(value) ? (
              <option value={value}>Assignee not found</option>
            ) : null}
          </select>
        ) : (
          <input type="text" {...commonProps} />
        )}
      </label>
    );
  };

  const handleDelete = async () => {
    if (!selectedRowId) return;
    setDeleting(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("client_list").delete().eq("property_id", selectedRowId);
      if (error) {
        setStatus({ type: "error", message: error.message });
        setDeleting(false);
        return false;
      }
      setRows((current) => current.filter((row) => row.property_id !== selectedRowId));
      setSelectedRowId(null);
      setFormState(emptyFormState());
      setStatus({ type: "success", message: "Client removed from the list." });
      return true;
    } catch (deleteError) {
      console.error("Failed to delete client", deleteError);
      setStatus({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete the client. Please try again.",
      });
      return false;
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateJobs = async () => {
    if (!selectedRowId) return;
    setCreatingJobs(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: selectedRowId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: string; message?: string }
        | null;

      if (!response.ok) {
        setStatus({
          type: "error",
          message: payload?.message ?? "Unable to create jobs for this property.",
        });
        return;
      }

      setStatus({
        type: payload?.status === "error" ? "error" : "success",
        message: payload?.message ?? "Jobs created for this property.",
      });
    } catch (createError) {
      console.error("Failed to create jobs", createError);
      setStatus({
        type: "error",
        message:
          createError instanceof Error
            ? createError.message
            : "Unable to create jobs for this property. Please try again.",
      });
    } finally {
      setCreatingJobs(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Property List</h2>
              <p className="text-sm text-gray-700">Search, review, and select a property to edit every column.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadRows}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowNewClientModal(true)}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                Add property
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-800" htmlFor="client-search">
                Quick search
              </label>
              <input
                id="client-search"
                type="search"
                placeholder="Search by address or client"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800" htmlFor="assigned-filter">
                Filter by assignee
              </label>
              <select
                id="assigned-filter"
                value={assignedFilter}
                onChange={(event) => setAssignedFilter(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">All assignees</option>
                <option value="__unassigned__">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800" htmlFor="sort-day">
                Sort by bin day
              </label>
              <select
                id="sort-day"
                value={sortField}
                onChange={(event) => setSortField(event.target.value as typeof sortField)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="">No sorting</option>
                <option value="put_bins_out">Sort by Put out day</option>
                <option value="collection_day">Sort by Bring in day</option>
              </select>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <p className="p-4 text-sm text-gray-700">Loading property list…</p>
            ) : filteredRows.length === 0 ? (
              <p className="p-4 text-sm text-gray-700">No properties match the current filters.</p>
            ) : (
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Assigned to</th>
                    <th className="px-4 py-3 text-left">Put out</th>
                    <th className="px-4 py-3 text-left">Bring in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((row) => {
                    const assignedName = row.assigned_to ? staffById.get(row.assigned_to) : null;
                    const isSelected = row.property_id === selectedRowId;
                    return (
                      <tr
                        key={row.property_id}
                        onClick={() => handleSelectRow(row)}
                        className={`h-[92px] cursor-pointer align-middle transition hover:bg-gray-100 ${
                          isSelected ? "bg-gray-100" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 align-middle text-sm text-gray-900">
                          <div className="font-semibold text-gray-900 whitespace-nowrap truncate" title={row.address ?? undefined}>
                            {row.address ?? "—"}
                          </div>
                          <div className="text-xs text-gray-600 whitespace-nowrap truncate" title={
                            row.client_name ?? row.company ?? undefined
                          }>
                            {row.client_name ?? row.company ?? "Property"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {assignedName ?? (row.assigned_to ? "Assignee not found" : "Unassigned")}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700">{row.put_bins_out ?? "—"}</td>
                        <td className="px-4 py-3 align-middle text-sm text-gray-700">{row.collection_day ?? "—"}</td>
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
              <h3 className="text-lg font-semibold text-gray-900">Property details</h3>
              <p className="text-xs text-gray-600">Update any column and save to sync with Supabase.</p>
            </div>
            {selectedRow && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateJobs}
                  disabled={creatingJobs}
                  className="rounded-lg border border-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingJobs ? "Creating…" : "Create Jobs"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="rounded-lg border border-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
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

          {!selectedRow ? (
            <p className="text-sm text-gray-700">Select a property from the table to start editing.</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {renderSingleField(editableClientFields.find((field) => field.key === "client_name")!)}
                    {renderSingleField(editableClientFields.find((field) => field.key === "company")!)}
                    {renderSingleField(editableClientFields.find((field) => field.key === "email")!)}
                    {renderSingleField(editableClientFields.find((field) => field.key === "address")!)}
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderSingleField(editableClientFields.find((field) => field.key === "lat_lng")!)}
                    {renderSingleField(editableClientFields.find((field) => field.key === "assigned_to")!)}
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderSingleField(editableClientFields.find((field) => field.key === "put_bins_out")!)}
                    {renderSingleField(editableClientFields.find((field) => field.key === "collection_day")!)}
                  </div>
                </div>

                {editableClientFields.map((field) => {
                  if (
                    field.key === "red_freq" ||
                    field.key === "yellow_freq" ||
                    field.key === "green_freq"
                  ) {
                    return renderBinGroup(field.key.split("_")[0] as "red" | "yellow" | "green");
                  }

                  if (isBinGroupKey(field.key)) {
                    return null;
                  }

                  if (
                    field.key === "lat_lng" ||
                    field.key === "assigned_to" ||
                    field.key === "put_bins_out" ||
                    field.key === "collection_day" ||
                    field.key === "client_name" ||
                    field.key === "company" ||
                    field.key === "email" ||
                    field.key === "address"
                  ) {
                    return null;
                  }

                  return renderSingleField(field);
                })}
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
                <p className="font-semibold text-gray-900">This week’s bins</p>
                <p className="mt-1 text-gray-700">
                  {binSchedule.activeColors.length
                    ? binSchedule.activeColors.join(", ")
                    : "No bins scheduled this week with the current selections."}
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  Preview follows the Supabase refresh_jobs fortnightly flip logic.
                </p>
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
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete property"
        description="Are you sure you want to remove this property from the list? This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete property"}
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

      {showNewClientModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <NewClientForm
              onClose={() => setShowNewClientModal(false)}
              onCreated={loadRows}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
