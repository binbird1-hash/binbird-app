"use client";

import { useId } from "react";

type NoticeModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actionLabel?: string;
};

export function NoticeModal({ open, onClose, title, description, actionLabel = "OK" }: NoticeModalProps) {
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-black p-6 text-center shadow-xl"
      >
        <p id={titleId} className="text-base font-semibold text-white">
          {title}
        </p>
        {description && (
          <p id={descriptionId} className="mt-2 text-sm text-white/60">
            {description}
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-[#E21C21] px-4 py-2 font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E21C21]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
