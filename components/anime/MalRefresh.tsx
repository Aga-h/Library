"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * For a series imported from MyAnimeList: walk the run again to pick up seasons and films released
 * since, and episode counts still growing. Only ever adds — episodes you have watched are never
 * touched, and entries you left out at the first import are not pushed back in.
 */
export default function MalRefresh({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/anime/mal/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't check MyAnimeList");
      return;
    }
    const added = (data.entries ?? []).filter((l: { outcome: string }) => l.outcome === "added").length;
    setMessage(added ? `${added} new from MyAnimeList` : "Up to date with MyAnimeList");
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
