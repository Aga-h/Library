"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Minus, Plus } from "lucide-react";

/**
 * Log episodes from a season card — TV or anime: one more, one fewer, or the whole season. The
 * status follows on its own — the API derives it from the counts.
 */
export default function EpisodeButtons({
  apiPath, title, episodesWatched, totalEpisodes,
}: {
  /** The entry's PATCH endpoint, e.g. `/api/tv/<id>`; it takes `{ episodesWatched }`. */
  apiPath: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const busy = saving || isPending;
  const complete = totalEpisodes !== null && totalEpisodes > 0 && episodesWatched >= totalEpisodes;

  async function set(next: number) {
    setSaving(true);
    try {
      await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodesWatched: next }),
      });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const button = "flex items-center justify-center h-7 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-t border-gray-100">
      <button type="button" onClick={() => set(episodesWatched - 1)} disabled={busy || episodesWatched <= 0}
        aria-label={`One episode fewer of ${title}`} title="One episode fewer"
        className={`${button} w-7 border-gray-200 text-gray-500 hover:bg-gray-50`}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => set(episodesWatched + 1)} disabled={busy || complete}
        aria-label={`Watched one more episode of ${title}`} title="Watched one more episode"
        className={`${button} w-7 border-gray-200 text-gray-700 hover:bg-gray-50`}>
        <Plus className="w-3.5 h-3.5" />
      </button>
      {totalEpisodes !== null && totalEpisodes > 0 && (
        <button type="button" onClick={() => set(totalEpisodes)} disabled={busy || complete}
          aria-label={complete ? `${title}: every episode watched` : `Mark every episode of ${title} watched`}
          title={complete ? "Every episode watched" : "Mark the whole season watched"}
          className={`${button} flex-1 gap-1 px-2 ${complete ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <CheckCheck className="w-3.5 h-3.5" /> {complete ? "Watched" : "All"}
        </button>
      )}
    </div>
  );
}
