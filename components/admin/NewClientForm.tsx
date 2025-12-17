"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
  CLIENT_DATE_FIELD_KEYS,
  CLIENT_FIELD_CONFIGS,
  CLIENT_NUMBER_FIELD_KEYS,
  type ClientListRow,
} from "./clientFieldConfig";

type NewClientFormProps = {
  onClose?: () => void;
  onCreated?: () => void;
};

type ClientFormState = Record<string, string>;

type StaffMember = {
  id: string;
  name: string;
  role: string | null;
};

type ExistingClient = {
  property_id: string;
  client_name: string | null;
  company: string | null;
  email: string | null;
};

const createInitialState = () => {
  const state: ClientFormState = {};
  CLIENT_FIELD_CONFIGS.forEach(({ key }) => {
    state[key as string] = key === "red_bins" || key === "yellow_bins" || key === "green_bins" ? "1" : "";
  });
  return state;
};

const visibleClientFields = CLIENT_FIELD_CONFIGS.filter(
  (field) => field.key !== "property_id" && field.key !== "account_id",
);
const fullWidthFields = new Set<string>(["address", "photo_path", "notes"]);
const binCountKeys = new Set<string>(["red_bins", "yellow_bins", "green_bins"]);
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

const sanitiseBinCount = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.length) return "";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.max(0, parsed));
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

const parseNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function NewClientForm({ onClose, onCreated }: NewClientFormProps = {}) {
  const supabase = useSupabase();
  const [formState, setFormState] = useState<ClientFormState>(createInitialState());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [existingClients, setExistingClients] = useState<ExistingClient[]>([]);
  const [selectedExistingClient, setSelectedExistingClient] = useState<string>("");
  const baseInputClasses =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300";
  const selectClasses = `${baseInputClasses} pr-12`;

  useEffect(() => {
    const loadStaff = async () => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("user_id, full_name, role")
        .in("role", ["staff", "admin"]);

      if (error) {
        console.warn("Failed to load staff", error);
        setStaff([]);
        return;
      }

      setStaff(
        (data ?? []).map((member) => ({
          id: member.user_id,
          name: member.full_name?.trim().length ? member.full_name : "Team member",
          role: member.role ?? null,
        })),
      );
    };

    const loadExistingClients = async () => {
      const { data, error } = await supabase
        .from("client_list")
        .select("property_id, client_name, company, email")
        .order("client_name", { ascending: true });

      if (error) {
        console.warn("Failed to load existing clients", error);
        setExistingClients([]);
        return;
      }

      const uniqueClients: ExistingClient[] = [];
      const seen = new Set<string>();

      (data ?? []).forEach((client) => {
        const primaryName = client.client_name?.trim().length
          ? client.client_name
          : client.company?.trim().length
            ? client.company
            : client.email ?? client.property_id;
        const dedupeKey = primaryName?.toLowerCase() ?? client.property_id;

        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        uniqueClients.push(client as ExistingClient);
      });

      setExistingClients(uniqueClients);
    };

    void loadStaff();
    void loadExistingClients();
  }, [supabase]);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member.name] as const)), [staff]);

  const handleChange = (key: string, value: string) => {
    let nextValue = value;

    if (binCountKeys.has(key)) {
      nextValue = sanitiseBinCount(value);
    }

    setFormState((previous) => ({ ...previous, [key]: nextValue }));
  };

  const handleExistingClientSelect = (propertyId: string) => {
    setSelectedExistingClient(propertyId);

    if (!propertyId.length) {
      setFormState((previous) => ({ ...previous, client_name: "", company: "", email: "" }));
      return;
    }

    const selectedClient = existingClients.find((client) => client.property_id === propertyId);
    if (!selectedClient) return;

    setFormState((previous) => ({
      ...previous,
      client_name: selectedClient.client_name ?? "",
      company: selectedClient.company ?? "",
      email: selectedClient.email ?? "",
    }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {};

    Object.entries(formState).forEach(([key, rawValue]) => {
      const value = rawValue ?? "";
      const asKey = key as keyof ClientListRow;
      if (CLIENT_NUMBER_FIELD_KEYS.includes(asKey)) {
        payload[key] = parseNumberInput(value);
      } else if (CLIENT_DATE_FIELD_KEYS.includes(asKey)) {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const propertyId = crypto.randomUUID();
      const payload = { ...buildPayload(), property_id: propertyId };

      const { error } = await supabase.from("client_list").insert(payload);
      if (error) {
        setStatus({ type: "error", message: error.message });
        setSaving(false);
        return;
      }

      setStatus({ type: "success", message: "Client property added to the list." });
      setFormState(createInitialState());
      setSelectedExistingClient("");
      onCreated?.();
      if (onClose) {
        onClose();
      }
    } catch (submitError) {
      console.error("Failed to create client", submitError);
      setStatus({
        type: "error",
        message: submitError instanceof Error ? submitError.message : "Unable to add the client. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderBinGroup = (prefix: "red" | "yellow" | "green") => {
    const freqKey = `${prefix}_freq` as keyof ClientListRow;
    const binsKey = `${prefix}_bins` as keyof ClientListRow;
    const flipKey = `${prefix}_flip` as keyof ClientListRow;
    const freqValue = formState[freqKey as string] ?? "";
    const binsValue = formState[binsKey as string] || defaultBinCount;
    const flipValue = formState[flipKey as string] ?? "";

    return (
      <div key={`${prefix}-bin-group`} className="sm:col-span-2 lg:col-span-3">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">{`${prefix[0].toUpperCase()}${prefix.slice(1)} Bin Frequency`}</span>
            <select
              id={`new-client-${freqKey as string}`}
              value={freqValue}
              onChange={(event) => handleChange(freqKey as string, event.target.value)}
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
              id={`new-client-${binsKey as string}`}
              type="number"
              min={0}
              step="any"
              value={binsValue}
              onChange={(event) => handleChange(binsKey as string, event.target.value)}
              className={baseInputClasses}
            />
          </label>

          <label className="flex flex-col text-sm text-gray-900">
            <span className="font-medium text-gray-800">{`${prefix[0].toUpperCase()}${prefix.slice(1)} Flip`}</span>
            <div className="mt-1 flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800">
              <input
                id={`new-client-${flipKey as string}`}
                type="checkbox"
                checked={flipValue === "Yes"}
                onChange={(event) => handleChange(flipKey as string, event.target.checked ? "Yes" : "")}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              <span className="text-sm">Yes</span>
            </div>
          </label>
        </div>
      </div>
    );
  };

  const renderSingleField = (field: (typeof CLIENT_FIELD_CONFIGS)[number]) => {
    const value = formState[field.key as string] ?? "";
    const isFullWidth = fullWidthFields.has(field.key as string);

    const commonProps = {
      id: `new-client-${field.key as string}`,
      value,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleChange(field.key as string, event.target.value),
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
              id={`new-client-${field.key as string}`}
              type="checkbox"
              checked={value === "Yes"}
              onChange={(event) => handleChange(field.key as string, event.target.checked ? "Yes" : "")}
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
            {value && !staffById.has(value) ? <option value={value}>Assignee not found</option> : null}
          </select>
        ) : (
          <input type="text" {...commonProps} />
        )}
      </label>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Add property</h2>
          <p className="text-sm text-gray-700">
            Create a new client list record. Core details are optional and can be updated later.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
          >
            Close
          </button>
        ) : (
          <Link
            href="/admin/clients"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
          >
            Back to client list
          </Link>
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

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-gray-100 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col text-sm text-gray-900 sm:col-span-2 lg:col-span-3">
            <span className="font-medium text-gray-800">Use existing client (optional)</span>
            <select
              id="existing-client"
              value={selectedExistingClient}
              onChange={(event) => handleExistingClientSelect(event.target.value)}
              className={selectClasses}
            >
              <option value="">Create a new client</option>
              {existingClients.map((client) => {
                const primaryName = client.client_name?.trim().length ? client.client_name : client.company;
                const secondary = client.company && primaryName !== client.company ? client.company : client.email;
                return (
                  <option key={client.property_id} value={client.property_id}>
                    {primaryName ?? "Client"}
                    {secondary ? ` — ${secondary}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {renderSingleField(visibleClientFields.find((field) => field.key === "client_name")!)}
              {renderSingleField(visibleClientFields.find((field) => field.key === "company")!)}
              {renderSingleField(visibleClientFields.find((field) => field.key === "email")!)}
              {renderSingleField(visibleClientFields.find((field) => field.key === "address")!)}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {renderSingleField(visibleClientFields.find((field) => field.key === "lat_lng")!)}
              {renderSingleField(visibleClientFields.find((field) => field.key === "assigned_to")!)}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {renderSingleField(visibleClientFields.find((field) => field.key === "put_bins_out")!)}
              {renderSingleField(visibleClientFields.find((field) => field.key === "collection_day")!)}
            </div>
          </div>

          {visibleClientFields.map((field) => {
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
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create property"}
          </button>
        </div>
      </form>
    </div>
  );
}
