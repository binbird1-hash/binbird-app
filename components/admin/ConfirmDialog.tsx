type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                destructive ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              !
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {description ? <p className="text-sm text-gray-700">{description}</p> : null}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                destructive
                  ? "bg-red-600 shadow hover:bg-red-700"
                  : "bg-gray-900 shadow hover:bg-gray-800"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
