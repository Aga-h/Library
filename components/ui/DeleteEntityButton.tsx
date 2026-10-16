"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import PhoneSheet from "@/components/ui/PhoneSheet";

interface Props {
  /** e.g. "/api/comics/publishers/abc123" */
  apiPath: string;
  /** Where to land after a successful delete. */
  redirectTo: string;
  /** Shown in the confirm step, e.g. "This also deletes 3 universes, 12 comics and 340 issues." */
  warning?: string;
}

export default function DeleteEntityButton({ apiPath, redirectTo, warning }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch(apiPath, { method: "DELETE" });
    if (res.ok) {
      router.push(redirectTo);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Delete failed");
    setLoading(false);
    setConfirming(false);
  }

  const cancel = () => setConfirming(false);

  // The button is 38px tall on phones, a thumb's width, and the compact 28px from sm up.
  const trigger = (
    <div className="flex flex-col items-end gap-1.5">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );

  if (!confirming) return trigger;

  return (
    <>
      {/* sm up: the confirm takes the button's place, in the row. */}
      <div className="flex flex-col items-end gap-1.5 max-sm:hidden">
        {warning && <p className="text-xs text-red-600 text-right max-w-xs break-words">{warning}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Deleting…" : "Confirm"}
          </button>
          <button
            onClick={cancel}
            className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      {/* Phones: the button stays where it was and the confirm comes up from the bottom edge —
          the header row it sits in has no room for the warning and two buttons beside it. */}
      <div className="sm:hidden">{trigger}</div>
      <PhoneSheet label="Confirm delete" onDismiss={cancel}>
        <p className="text-sm font-semibold text-gray-900">Delete this?</p>
        {warning && <p className="-mt-1 text-sm text-red-600 break-words">{warning}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 flex items-center justify-center bg-red-600 text-white px-3 py-3 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Deleting…" : "Confirm"}
          </button>
          <button
            onClick={cancel}
            className="flex-1 border border-gray-200 text-gray-600 px-3 py-3 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </PhoneSheet>
    </>
  );
}
