"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import type { Expense, ExpenseCategory } from "@prisma/client";

const CATEGORIES: ExpenseCategory[] = [
  "FOOD", "BOOKS", "EDUCATION", "ENTERTAINMENT", "CLOTHING",
  "SUBSCRIPTIONS", "SELF_CARE", "TRANSPORTATION", "OTHER", "CASH",
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: "Food",
  BOOKS: "Books",
  EDUCATION: "Education",
  ENTERTAINMENT: "Entertainment",
  CLOTHING: "Clothing",
  SUBSCRIPTIONS: "Subscriptions",
  SELF_CARE: "Self Care",
  TRANSPORTATION: "Transportation",
  OTHER: "Other",
  CASH: "Cash",
};

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

interface Props {
  expenses: Expense[];
  year: number;
  month: number;
}

export default function ExpenseSection({ expenses, year, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<ExpenseCategory>("FOOD");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setAdding(true);
    try {
      await fetch(`/api/finances/${year}/${month}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount: amt, description: description || undefined }),
      });
      setAmount("");
      setDescription("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/finances/expenses/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: expenses.filter((e) => e.category === cat),
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Expenses</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-5">
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
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
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No expenses yet this month.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ cat, items, total }) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">{CATEGORY_LABELS[cat]}</span>
                <span className="text-sm font-semibold text-gray-900">{fmt(total)}</span>
              </div>
              <div className="space-y-1">
                {items.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-600 flex-1 truncate">
                      {expense.description || CATEGORY_LABELS[expense.category]}
                    </span>
                    <span className="text-gray-900 font-medium ml-3">{fmt(expense.amount)}</span>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="ml-3 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-900">
            <span>Total</span>
            <span>{fmt(expenses.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
