"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shirt, Droplets } from "lucide-react";

export default function WardrobeActions({ garmentId, wornCount }: { garmentId: string; wornCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"wear" | "wash" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hit(action: "wear" | "wash") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/wardrobe/${garmentId}/${action}`, { method: "POST" });
      // Previously unchecked: a failed "Mark as Washed" looked identical to a successful one.
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("That did not save. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 max-sm:w-full">
      {error && <p className="text-red-600 text-xs">{error}</p>}
      {/* When the two don't fit side by side on a narrow phone, the second takes its own row. */}
      <div className="flex gap-3 max-sm:flex-wrap">
      <button
        onClick={() => hit("wear")}
        disabled={loading !== null}
        className="flex items-center justify-center gap-2 whitespace-nowrap border border-gray-200 text-gray-700 px-4 py-2 max-sm:flex-1 max-sm:py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <Shirt className="w-4 h-4" />
        {loading === "wear" ? "Updating…" : "Wore Today"}
      </button>
      {wornCount > 0 && (
        <button
          onClick={() => hit("wash")}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 whitespace-nowrap bg-blue-600 text-white px-4 py-2 max-sm:flex-1 max-sm:py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Droplets className="w-4 h-4" />
          {loading === "wash" ? "Marking…" : "Mark as Washed"}
        </button>
      )}
      </div>
    </div>
  );
}
