"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import type { AdditionalIncome } from "@prisma/client";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Additional Income</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      {income.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No additional income this month.</p>
      ) : (
        <div className="space-y-1">
          {income.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-600 flex-1 truncate">{entry.description || "Income"}</span>
              <span className="text-emerald-600 font-medium ml-3">+{fmt(entry.amount)}</span>
              <button
                onClick={() => handleDelete(entry.id)}
                className="ml-3 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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
