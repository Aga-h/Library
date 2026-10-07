"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCE_LABELS, type FundSource } from "@/lib/fund-sources";

/** Each pot's colour, used wherever it appears. */
export const SOURCE_TAG_CLS: Record<FundSource, string> = {
  BASE: "bg-sky-100 text-sky-700",
  EXTRA: "bg-violet-100 text-violet-700",
};

/**
 * Which card paid, on an expense or subscription row. Tapping it moves the entry to the other card
 * — the way to fix one logged on the wrong card, or one recorded before sources existed.
 */
export function SourceToggle({ source, apiPath, onMoved }: { source: FundSource; apiPath: string; onMoved?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const other: FundSource = source === "BASE" ? "EXTRA" : "BASE";

  async function move() {
    setBusy(true);
    const res = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: other }),
    });
    setBusy(false);
    if (res.ok) {
      onMoved?.();
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={move} disabled={busy}
      title={`Paid from ${SOURCE_LABELS[source]} — tap to move it to ${SOURCE_LABELS[other]}`}
      aria-label={`Paid from ${SOURCE_LABELS[source]}. Move to ${SOURCE_LABELS[other]}`}
      className={`fund-tag fund-tag-${source.toLowerCase()} ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50 ${SOURCE_TAG_CLS[source]}`}>
      {SOURCE_LABELS[source]}
    </button>
  );
}

/** Two buttons to pick the card an expense is paid from, each showing what is left on it. */
export function SourcePicker({
  value, onChange, left, size = "md",
}: {
  value: FundSource;
  onChange: (s: FundSource) => void;
  /** What's left on each card, when known. */
  left?: Record<FundSource, number> | null;
  size?: "md" | "lg";
}) {
  const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
  return (
    <div role="radiogroup" aria-label="Paid from" className="fund-picker grid grid-cols-2 gap-2">
      {(["BASE", "EXTRA"] as const).map((s) => {
        const active = value === s;
        const amount = left?.[s];
        return (
          <button key={s} type="button" role="radio" aria-checked={active} onClick={() => onChange(s)}
            className={`fund-choice fund-choice-${s.toLowerCase()} flex flex-col items-start rounded-xl border text-left transition-colors ${
              size === "lg" ? "px-4 py-3" : "px-3 py-2"
            } ${active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
            <span className={`font-semibold ${size === "lg" ? "text-base" : "text-sm"}`}>{SOURCE_LABELS[s]}</span>
            {amount !== undefined && (
              <span className={`text-xs tabular-nums ${active ? "text-gray-300" : amount < 0 ? "text-red-600" : "text-gray-500"}`}>
                {fmt(amount)} left
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
