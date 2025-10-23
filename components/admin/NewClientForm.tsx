"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
  CLIENT_DATE_FIELD_KEYS,
  CLIENT_FIELD_CONFIGS,
  CLIENT_NUMBER_FIELD_KEYS,
  type ClientListRow,
} from "./ClientListManager";

type ClientFormState = Record<string, string>;

const createInitialState = () => {
  const state: ClientFormState = {};
  CLIENT_FIELD_CONFIGS.forEach(({ key }) => {
    state[key as string] = "";
  });
  return state;
};

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
      const payload = buildPayload();
      if (typeof payload.property_id !== "string" || !payload.property_id.trim().length) {
        setStatus({ type: "error", message: "Property ID is required." });
        setSaving(false);
        return;
      }

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
          <h2 className="text-2xl font-semibold text-white">Add property</h2>
          <p className="text-sm text-slate-300">
            Create a new client list record. Every field is optional except for the property ID.
          </p>
        </div>
        <Link
          href="/admin/clients"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Back to client list
        </Link>
      </div>

      {status && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            status.type === "success"
              ? "border border-green-500/40 bg-green-500/10 text-green-200"
              : "border border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {CLIENT_FIELD_CONFIGS.map((field) => {
            const value = formState[field.key as string] ?? "";
            const commonProps = {
              id: `new-client-${field.key as string}`,
              value,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                handleChange(field.key as string, event.target.value),
              className:
                "mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40",
            } as const;

            return (
              <label key={field.key as string} className="flex flex-col text-sm text-slate-200">
                <span className="font-medium">{field.label}</span>
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
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create property"}
          </button>
        </div>
      </form>
    </div>
  );
}
