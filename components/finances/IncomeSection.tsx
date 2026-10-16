"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import type { AdditionalIncome } from "@prisma/client";

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

interface Props {
  income: AdditionalIncome[];
  year: number;
  month: number;
}

export default function IncomeSection({ income, year, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      await fetch(`/api/finances/${year}/${month}/income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, description: description || undefined }),
      });
      setAmount("");
      setDescription("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/finances/income/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Additional Income</h2>
      <p className="text-xs text-gray-500 mb-4">Goes onto your Extra card.</p>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
            className="min-w-0 flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Description"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      {income.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No additional income this month.</p>
      ) : (
        <div className="space-y-1">
          {income.map((entry) => (
            // Phones: a long description gets the line to itself; the amount and delete drop under it.
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-y-1 py-1.5 px-3 bg-gray-50 rounded-lg text-sm sm:flex-nowrap">
              <span className="text-gray-600 flex-auto min-w-0 break-words sm:flex-1 sm:truncate">{entry.description || "Income"}</span>
              <span className="ml-auto flex items-center sm:contents">
                <span className="text-emerald-600 font-medium ml-2 whitespace-nowrap sm:ml-3">+{fmt(entry.amount)}</span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  aria-label={`Delete ${entry.description || "income"}`}
                  className="-my-1.5 -mr-2 ml-1 flex-shrink-0 p-3 text-gray-400 hover:text-red-500 transition-colors sm:my-0 sm:mr-0 sm:ml-3 sm:p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-900 px-3">
            <span>Total</span>
            <span className="text-emerald-600">+{fmt(income.reduce((s, i) => s + i.amount, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
