"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

/**
 * Duplicates a day plan and opens the copy for editing — copying is almost always the first
 * half of "make one like that but different", so landing on the original would just mean an
 * extra click every time.
 */
export default function CopyDayButton({
  planId, compact = false,
}: { planId: string; compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy(e: React.MouseEvent) {
    // On the list the button sits on top of a card-wide <Link>; without this the copy races
    // a navigation to the original.
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    setError(null);
    const res = await fetch(`/api/calendar/days/${planId}/copy`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not copy this day");
      setLoading(false);
      return;
    }
    router.push(`/calendar/days/${data.id}`);
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        disabled={loading}
        title={error ?? "Duplicate this day"}
        aria-label="Duplicate this day"
        className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
          error ? "text-red-600" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
        }`}
      >
        <Copy className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleCopy}
        disabled={loading}
        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <Copy className="w-3.5 h-3.5" /> {loading ? "Copying…" : "Duplicate"}
      </button>
    </div>
  );
}
