"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * For a series imported from TMDB: fetch the show again to pick up seasons and episodes released
 * since. The import only ever adds, so episodes you have watched are never touched.
 */
export default function TmdbTvRefresh({ universeId, tmdbId }: { universeId: string | null; tmdbId: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    // Imported into the universe it already sits in, so it can never be moved by this.
    const res = await fetch("/api/tv/tmdb/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId, tmdbIds: [tmdbId], watched: false }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't check TMDB");
      return;
    }
    const line = data.report?.[0];
    if (!line) {
      setMessage(data.failed?.[0]?.reason ? `TMDB: ${data.failed[0].reason}` : "Couldn't check TMDB");
      return;
    }
    const parts = [];
    if (line.seasonsAdded.length) parts.push(`${line.seasonsAdded.length} new season${line.seasonsAdded.length === 1 ? "" : "s"}`);
    if (line.seasonsUpdated.length) parts.push(`${line.seasonsUpdated.length} updated`);
    setMessage(parts.length ? `${parts.join(", ")} from TMDB` : "Up to date with TMDB");
    startTransition(() => router.refresh());
  }

  return (
    <span className="flex items-center gap-2">
      <button onClick={refresh} disabled={busy}
        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {busy ? "Checking…" : "Check for new seasons"}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </span>
  );
}
