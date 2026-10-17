"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import type { Expense, ExpenseCategory } from "@prisma/client";
import type { FundSource } from "@/lib/fund-sources";
import { useStoredSource } from "@/lib/fund-source-client";
import { SourcePicker, SourceToggle } from "@/components/finances/SourceTag";
import { PHONE_TALL, ROW_END_ICON_BTN, confirmOnTouch } from "@/components/finances/touch";

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
  /** What's left on each card this month, shown on the picker. */
  left: Record<FundSource, number>;
}

export default function ExpenseSection({ expenses, year, month, left }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<ExpenseCategory>("FOOD");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useStoredSource();
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
        body: JSON.stringify({ category, amount: amt, description: description || undefined, source }),
      });
      setAmount("");
      setDescription("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(expense: Expense) {
    if (!confirmOnTouch(`Delete "${expense.description || CATEGORY_LABELS[expense.category]}" (${fmt(expense.amount)})?`)) return;
    await fetch(`/api/finances/expenses/${expense.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: expenses.filter((e) => e.category === cat),
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Expenses</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-5">
        {/* Phones: one field to a row and Add last, under the card picker — filled top to bottom.
            From sm the wrapper is a row again: category, amount and Add, as before. */}
        <div className="contents sm:flex sm:gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            aria-label="Category"
            className="w-full sm:w-auto sm:flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            aria-label="Amount"
            className="sm:w-28 sm:flex-initial border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <button
            type="submit"
            disabled={adding || isPending}
            className={`order-last flex items-center justify-center gap-1 bg-emerald-600 text-white px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 sm:order-none sm:py-2 ${PHONE_TALL}`}
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
        <SourcePicker value={source} onChange={setSource} left={left} />
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
                  <div key={expense.id} className="flex flex-wrap items-center justify-between gap-y-1 py-1.5 px-3 bg-gray-50 rounded-lg text-sm sm:flex-nowrap">
                    {/* Phones: a long description gets the line to itself and wraps, and the tag,
                        amount and delete drop under it on the right. From sm the wrapper around
                        them vanishes (contents) and it is one truncated line as before. */}
                    <span className="text-gray-600 flex-auto min-w-0 break-words sm:flex-1 sm:truncate">
                      {expense.description || CATEGORY_LABELS[expense.category]}
                    </span>
                    <span className="ml-auto flex items-center sm:contents">
                      <SourceToggle source={expense.source} apiPath={`/api/finances/expenses/${expense.id}`} />
                      <span className="text-gray-900 font-medium ml-2 whitespace-nowrap sm:ml-3">{fmt(expense.amount)}</span>
                      <button
                        onClick={() => handleDelete(expense)}
                        aria-label={`Delete ${expense.description || CATEGORY_LABELS[expense.category]}`}
                        className={`${ROW_END_ICON_BTN} ml-1 hover:text-red-500 sm:ml-3`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
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
