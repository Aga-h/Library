"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";

interface Props {
  /** e.g. "/api/tv/series" — the collection the *child* lives in, not the parent. */
  apiBase: string;
  /** Payload key naming the parent, e.g. "universeId" | "seriesId". */
  parentKey: string;
  /** Id written into `parentKey`. */
  parentId: string;
  /** Candidates. Filter out whatever is already inside this parent before passing it in. */
  options: HierarchyOption[];
  /** Button text, e.g. "Add existing series". */
  label: string;
  /** Shown on the disabled button when there is nothing left to offer. */
  emptyHint: string;
}

/**
 * Pulls an entry that already exists into this parent — the counterpart to the "Add …"
 * button, which only ever creates a new one. An entry currently filed elsewhere is moved,
 * which is why every option shows its present parent.
 */
export default function AttachExistingButton({
  apiBase, parentKey, parentId, options, label, emptyHint,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Without this the button re-enables the moment the fetch resolves, while the server
  // component is still re-rendering — and a second click sends a second PATCH.
  const [pending, startTransition] = useTransition();

  const busy = loading || pending;

  async function handleAttach() {
    if (!choice) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`${apiBase}/${choice}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [parentKey]: parentId }),
    });

    if (!res.ok) {
      // The route's own message — a duplicate name here is a 409, a stale id a 404.
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add it");
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
    setChoice("");
    startTransition(() => router.refresh());
  }

  if (!open) {
    // Kept visible but disabled when empty: this control exists because it was undiscoverable,
    // so hiding it in the one state a new library starts in would defeat the point.
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={options.length === 0}
        title={options.length === 0 ? emptyHint : undefined}
        className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <Plus className="w-4 h-4" /> {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 w-full sm:w-72">
      {error && <p className="text-xs text-red-600 text-right">{error}</p>}
      <div className="w-full">
        <HierarchySelect
          label={label}
          value={choice}
          onChange={setChoice}
          options={options}
          emptyLabel="Choose one…"
        />
      </div>
      <p className="text-xs text-gray-400 text-right">
        Anything already filed elsewhere is moved here, not copied.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAttach}
          disabled={busy || !choice}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          onClick={() => { setOpen(false); setChoice(""); setError(null); }}
          className="border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
