"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, RotateCcw } from "lucide-react";

export default function DealButtons({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "fill" | "redeal">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function deal(mode: "fill" | "redeal") {
    setBusy(mode);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/calendar/deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, mode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setConfirming(false);
    if (!res.ok) { setError(data.error ?? "Could not deal this month"); return; }
    setMessage(data.message ?? null);
    startTransition(() => router.refresh());
  }

  const working = busy !== null || pending;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && !error && <p className="text-xs text-gray-500">{message}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => deal("fill")}
          disabled={working}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <Shuffle className="w-4 h-4" /> {busy === "fill" ? "Dealing…" : "Fill empty days"}
        </button>
        {confirming ? (
          <>
            <button
              onClick={() => deal("redeal")}
              disabled={working}
              className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy === "redeal" ? "Re-dealing…" : "Replace all"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={working}
            title="Replaces every day in this month, including ones you set yourself"
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Re-deal
          </button>
        )}
      </div>
      {confirming && (
        <p className="text-xs text-red-600 text-right max-w-xs">
          This replaces every day in this month, including any you set by hand.
        </p>
      )}
    </div>
  );
}
