"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Plus } from "lucide-react";
import type { Subscription } from "@prisma/client";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

interface Props {
  subscriptions: Subscription[];
  year: number;
  month: number;
}

export default function SubscriptionSection({ subscriptions, year, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);

  const active = subscriptions.filter((s) => isSubscriptionActiveInMonth(s, year, month));
  const inactive = subscriptions.filter((s) => !isSubscriptionActiveInMonth(s, year, month));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0) return;
    setAdding(true);
    const now = new Date();
    try {
      await fetch("/api/finances/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: amt,
          startYear: now.getFullYear(),
          startMonth: now.getMonth() + 1,
        }),
      });
      setName("");
      setAmount("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleCancel(id: string) {
    await fetch(`/api/finances/subscriptions/${id}/cancel`, { method: "POST" });
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    await fetch(`/api/finances/subscriptions/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Subscriptions</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Name (e.g. Netflix)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <button
            type="submit"
            disabled={adding || isPending}
            className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </form>

      {active.length === 0 && inactive.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No subscriptions yet.</p>
      ) : (
        <div className="space-y-1">
          {active.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-700 flex-1 truncate font-medium">{sub.name}</span>
              <span className="text-gray-900 font-medium ml-3">{fmt(sub.amount)}</span>
              <button
                onClick={() => handleCancel(sub.id)}
                title="Cancel from next month"
                className="ml-2 text-gray-400 hover:text-orange-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(sub.id)}
                title="Delete permanently"
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {inactive.length > 0 && (
            <>
              {active.length > 0 && <div className="pt-1" />}
              {inactive.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm opacity-40">
                  <span className="text-gray-500 flex-1 truncate line-through">{sub.name}</span>
                  <span className="text-gray-500 ml-3">{fmt(sub.amount)}</span>
                  <button
                    onClick={() => handleDelete(sub.id)}
                    title="Delete permanently"
                    className="ml-3 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
          {active.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-900 px-3">
              <span>Total</span>
              <span>{fmt(active.reduce((s, sub) => s + sub.amount, 0))}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
