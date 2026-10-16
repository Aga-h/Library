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

  // Phones: −/+ are 36px squares, tapped with a thumb, and never give up width (in a half-width
  // card they used to be squeezed to 16px). The third button takes what is left and shows its word
  // whenever the word fits beside the icon, in whatever font the look sets: the icon's box is the
  // button's full height, so it alone makes the first flex line, and a word too wide for that line
  // wraps to a second one, which the button clips away (4px padding, not 8, so acid's wide "ALL"
  // still fits a half-width card at 360). Its aria-label still names it, and the card's badge
  // already says a season is done.
  // From sm up: the compact 28px row, exactly as before.
  const button = "flex items-center justify-center h-9 sm:h-7 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40";
  const square = `${button} w-9 sm:w-7 max-sm:shrink-0`;
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 border-t border-gray-100">
      <button type="button" onClick={() => set(episodesWatched - 1)} disabled={busy || episodesWatched <= 0}
        aria-label={`One episode fewer of ${title}`} title="One episode fewer"
        className={`${square} border-gray-200 text-gray-500 hover:bg-gray-50`}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => set(episodesWatched + 1)} disabled={busy || complete}
        aria-label={`Watched one more episode of ${title}`} title="Watched one more episode"
        className={`${square} border-gray-200 text-gray-700 hover:bg-gray-50`}>
        <Plus className="w-3.5 h-3.5" />
      </button>
      {totalEpisodes !== null && totalEpisodes > 0 && (
        <button type="button" onClick={() => set(totalEpisodes)} disabled={busy || complete}
          aria-label={complete ? `${title}: every episode watched` : `Mark every episode of ${title} watched`}
          title={complete ? "Every episode watched" : "Mark the whole season watched"}
          className={`${button} flex-1 gap-1 px-2 max-sm:px-1 max-sm:min-w-0 max-sm:flex-wrap max-sm:gap-0 max-sm:overflow-hidden ${complete ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <span className="flex shrink-0 items-center max-sm:h-full"><CheckCheck className="w-3.5 h-3.5" /></span>
          <span className="max-sm:ml-1 max-sm:whitespace-nowrap">{complete ? "Watched" : "All"}</span>
        </button>
      )}
    </div>
  );
}
