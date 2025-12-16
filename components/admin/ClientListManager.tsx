"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export type ClientListRow = {
  property_id: string;
  account_id: string | null;
  client_name: string | null;
  company: string | null;
  address: string | null;
  collection_day: string | null;
  put_bins_out: string | null;
  notes: string | null;
  red_freq: string | null;
  red_flip: string | null;
  red_bins: number | string | null;
  yellow_freq: string | null;
  yellow_flip: string | null;
  yellow_bins: number | string | null;
  green_freq: string | null;
  green_flip: string | null;
  green_bins: number | string | null;
  email: string | null;
  assigned_to: string | null;
  lat_lng: string | null;
  price_per_month: number | null;
  photo_path: string | null;
  trial_start: string | null;
  membership_start: string | null;
};

type ClientFormState = Record<keyof ClientListRow, string>;

type ClientFieldConfig = {
  key: keyof ClientListRow;
  label: string;
  type?: "text" | "textarea" | "number" | "date";
};

export const CLIENT_FIELD_CONFIGS: ClientFieldConfig[] = [
  { key: "property_id", label: "Property ID" },
  { key: "account_id", label: "Account ID" },
  { key: "client_name", label: "Client Name" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "lat_lng", label: "Lat/Lng" },
  { key: "collection_day", label: "Collection Day" },
  { key: "put_bins_out", label: "Put Bins Out" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "photo_path", label: "Photo Path" },
  { key: "red_freq", label: "Red Bin Frequency" },
  { key: "red_flip", label: "Red Flip" },
  { key: "red_bins", label: "Red Bins", type: "number" },
  { key: "yellow_freq", label: "Yellow Bin Frequency" },
  { key: "yellow_flip", label: "Yellow Flip" },
  { key: "yellow_bins", label: "Yellow Bins", type: "number" },
  { key: "green_freq", label: "Green Bin Frequency" },
  { key: "green_flip", label: "Green Flip" },
  { key: "green_bins", label: "Green Bins", type: "number" },
  { key: "price_per_month", label: "Price Per Month", type: "number" },
  { key: "trial_start", label: "Trial Start", type: "date" },
  { key: "membership_start", label: "Membership Start", type: "date" },
];

export const CLIENT_NUMBER_FIELD_KEYS: Array<keyof ClientListRow> = [
  "red_bins",
  "yellow_bins",
  "green_bins",
  "price_per_month",
];
export const CLIENT_DATE_FIELD_KEYS: Array<keyof ClientListRow> = ["trial_start", "membership_start"];

const numberFields = new Set(CLIENT_NUMBER_FIELD_KEYS);
const dateFields = new Set(CLIENT_DATE_FIELD_KEYS);
const editableClientFields = CLIENT_FIELD_CONFIGS.filter(
  (field) => field.key !== "property_id" && field.key !== "account_id",
);

const toFormState = (row: ClientListRow): ClientFormState => {
  const state = {} as ClientFormState;
  (Object.keys(row) as Array<keyof ClientListRow>).forEach((key) => {
    const value = row[key];
    state[key] = value === null || value === undefined ? "" : String(value);
  });
  return state;
};

const emptyFormState = (): ClientFormState => {
  const state = {} as ClientFormState;
  CLIENT_FIELD_CONFIGS.forEach(({ key }) => {
    state[key] = "";
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

export default function ClientListManager() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<ClientListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(emptyFormState);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_list")
      .select(
        "property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, red_freq, red_flip, red_bins, yellow_freq, yellow_flip, yellow_bins, green_freq, green_flip, green_bins, email, assigned_to, lat_lng, price_per_month, photo_path, trial_start, membership_start",
      )
      .order("client_name", { ascending: true });

    if (error) {
      console.warn("Failed to load client list", error);
      setRows([]);
      setStatus({ type: "error", message: "Unable to load client records." });
    } else {
      setRows((data ?? []) as ClientListRow[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const query = normaliseSearch(search);
    if (!query.length) {
      return rows;
    }
    return rows.filter((row) => {
      const haystack = [
        row.client_name,
        row.company,
        row.address,
        row.email,
        row.assigned_to,
      ]
        .map((value) => value?.toString().toLowerCase() ?? "")
        .join(" ");
      return haystack.includes(query);
    });
  }, [rows, search]);

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
    setFormState((previous) => ({ ...previous, [key]: value }));
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
    if (!selectedRowId) return;
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

  const handleDelete = async () => {
    if (!selectedRowId) return;
    const confirmed = window.confirm("Delete this client from the list? This cannot be undone.");
    if (!confirmed) return;
    setDeleting(true);
    setStatus(null);
    try {
      const { error } = await supabase.from("client_list").delete().eq("property_id", selectedRowId);
      if (error) {
        setStatus({ type: "error", message: error.message });
        setDeleting(false);
        return;
      }
      setRows((current) => current.filter((row) => row.property_id !== selectedRowId));
      setSelectedRowId(null);
      setFormState(emptyFormState());
      setStatus({ type: "success", message: "Client removed from the list." });
    } catch (deleteError) {
      console.error("Failed to delete client", deleteError);
      setStatus({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Unable to delete the client. Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Client List</h2>
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
              <Link
                href="/admin/clients/new"
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-gray-700"
              >
                Add property
              </Link>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800" htmlFor="client-search">
              Quick search
            </label>
            <input
              id="client-search"
              type="search"
              placeholder="Search by client, address, or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <p className="p-4 text-sm text-gray-700">Loading client list…</p>
            ) : filteredRows.length === 0 ? (
              <p className="p-4 text-sm text-gray-700">No clients match the current filters.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Address</th>
                    <th className="px-4 py-3 text-left">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((row) => {
                    const isSelected = row.property_id === selectedRowId;
                    return (
                      <tr
                        key={row.property_id}
                        onClick={() => handleSelectRow(row)}
                        className={`cursor-pointer transition hover:bg-gray-100 ${
                          isSelected ? "bg-gray-100" : "bg-white"
                        }`}
                      >
                        <td className="px-4 py-3 align-top text-sm text-gray-900">
                          <div className="font-semibold text-gray-900">{row.client_name ?? row.company ?? "Property"}</div>
                          {row.assigned_to && <div className="text-xs text-gray-600">Assigned to {row.assigned_to}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.address ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.email ?? "—"}</td>
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
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
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
              <div className="grid gap-4 sm:grid-cols-2">
                {editableClientFields.map((field) => {
                  const value = formState[field.key] ?? "";
                  const commonProps = {
                    id: `client-${field.key}`,
                    value,
                    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      handleInputChange(field.key, event.target.value),
                    className:
                      "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300",
                  } as const;

                  return (
                    <label key={field.key as string} className="flex flex-col text-sm text-gray-900">
                      <span className="font-medium text-gray-800">{field.label}</span>
                      {field.type === "textarea" ? (
                        <textarea rows={4} {...commonProps} />
                      ) : field.type === "number" ? (
                        <input type="number" step="any" {...commonProps} />
                      ) : field.type === "date" ? (
                        <input type="date" {...commonProps} />
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
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
