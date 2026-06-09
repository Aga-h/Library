"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

export default function BudgetConfig({ currentBudget }: { currentBudget: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [delta, setDelta] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(delta);
    if (isNaN(amt)) return;
    setSaving(true);
    try {
      await fetch("/api/finances/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: amt }),
      });
      setDelta("");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Monthly Budget</h2>
      <p className="text-2xl font-bold text-gray-900 mb-4">{fmt(currentBudget)}</p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="e.g. 200 or -50"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
        <button
          type="submit"
          disabled={saving || isPending}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Update
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-2">Enter a positive amount to increase, negative to decrease.</p>
    </div>
  );
}
