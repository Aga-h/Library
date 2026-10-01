"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * For a comic imported from Comic Vine: fetch the run again to pick up issues released since.
 * The import only ever adds, so this cannot disturb read or owned marks.
 */
export default function ComicVineRefresh({ universeId, volumeId }: { universeId: string; volumeId: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/comics/comicvine/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId, volumeId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't check Comic Vine");
      return;
    }
    const parts = [];
    if (data.added) parts.push(`${data.added} new issue${data.added === 1 ? "" : "s"}`);
    if (data.filled) parts.push(`${data.filled} filled in`);
    setMessage(parts.length ? `${parts.join(", ")} from Comic Vine` : "Up to date with Comic Vine");
    startTransition(() => router.refresh());
  }

  return (
    <span className="flex items-center gap-2">
      <button onClick={refresh} disabled={busy}
        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {busy ? "Checking…" : "Check for new issues"}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </span>
  );
}
