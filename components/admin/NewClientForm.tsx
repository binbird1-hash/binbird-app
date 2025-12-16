"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
  CLIENT_DATE_FIELD_KEYS,
  CLIENT_FIELD_CONFIGS,
  CLIENT_NUMBER_FIELD_KEYS,
  type ClientListRow,
} from "./ClientListManager";

type ClientFormState = Record<string, string>;

type StaffMember = {
  id: string;
  name: string;
  role: string | null;
};

const createInitialState = () => {
  const state: ClientFormState = {};
  CLIENT_FIELD_CONFIGS.forEach(({ key }) => {
    state[key as string] = "";
  });
  return state;
};

const visibleClientFields = CLIENT_FIELD_CONFIGS.filter(
  (field) => field.key !== "property_id" && field.key !== "account_id",
);

const parseNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function NewClientForm() {
  const supabase = useSupabase();
  const [formState, setFormState] = useState<ClientFormState>(createInitialState());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);

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

    void loadStaff();
  }, [supabase]);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member.name] as const)), [staff]);

  const handleChange = (key: string, value: string) => {
    setFormState((previous) => ({ ...previous, [key]: value }));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Add property</h2>
          <p className="text-sm text-gray-700">
            Create a new client list record. Core details are optional and can be updated later.
          </p>
        </div>
        <Link
          href="/admin/clients"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-gray-400 hover:text-gray-900"
        >
          Back to client list
        </Link>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleClientFields.map((field) => {
            const value = formState[field.key as string] ?? "";
            const commonProps = {
              id: `new-client-${field.key as string}`,
              value,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
                handleChange(field.key as string, event.target.value),
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
              ) : field.type === "assignee" ? (
                <select {...commonProps}>
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
