"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye } from "lucide-react";

/**
 * One tap to log a film as watched, or to take it back to the watchlist. Sits on the card's
 * poster, outside the card's link, so tapping it never opens the film.
 */
export default function WatchedToggle({ movieId, title, watched }: { movieId: string; title: string; watched: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await fetch(`/api/movies/${movieId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: watched ? "WANT_TO_WATCH" : "WATCHED" }),
      });
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving || isPending}
      aria-label={watched ? `${title}: watched — tap to put back on the watchlist` : `Mark ${title} as watched`}
      title={watched ? "Watched — tap to put back on the watchlist" : "Mark as watched"}
      className={`absolute top-2 left-2 z-10 flex items-center justify-center w-8 h-8 rounded-full border shadow-sm transition-colors disabled:opacity-60 ${
        watched
          ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
          : "bg-white/90 border-gray-200 text-gray-500 hover:bg-white hover:text-gray-900"
      }`}
    >
      {watched ? <Check className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
