"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Plus } from "lucide-react";
import type { Subscription } from "@prisma/client";
import { isSubscriptionActiveInMonth } from "@/lib/finances-utils";
import type { FundSource } from "@/lib/fund-sources";
import { SourcePicker, SourceToggle } from "@/components/finances/SourceTag";
import { PHONE_TALL, ROW_END_ICON_BTN, ROW_ICON_BTN, confirmOnTouch } from "@/components/finances/touch";

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
  // Subscriptions start on Base, the usual card for a regular bill; pick Extra if it isn't.
  const [source, setSource] = useState<FundSource>("BASE");
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
          source,
        }),
      });
      setName("");
      setAmount("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleCancel(sub: Subscription) {
    if (!confirmOnTouch(`Cancel "${sub.name}" from next month? It is still charged this month.`)) return;
    await fetch(`/api/finances/subscriptions/${sub.id}/cancel`, { method: "POST" });
    startTransition(() => router.refresh());
  }

  async function handleDelete(sub: Subscription) {
    if (!confirmOnTouch(`Delete "${sub.name}" permanently? It comes off every month's balance, past ones too.`)) return;
    await fetch(`/api/finances/subscriptions/${sub.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Subscriptions</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4">
        {/* Phones: one field to a row and Add last, under the card picker — filled top to bottom.
            From sm the wrapper is a row again: name, amount and Add, as before. */}
        <div className="contents sm:flex sm:gap-2">
          <input
            type="text"
            placeholder="Name (e.g. Netflix)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name"
            className="w-full sm:w-auto sm:flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
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
        <SourcePicker value={source} onChange={setSource} />
      </form>

      {active.length === 0 && inactive.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No subscriptions yet.</p>
      ) : (
        <div className="space-y-1">
          {active.map((sub) => (
            // Phones: a long name gets the line to itself; the tag, amount and buttons drop under it.
            <div key={sub.id} className="flex flex-wrap items-center justify-between gap-y-1 py-1.5 px-3 bg-gray-50 rounded-lg text-sm sm:flex-nowrap">
              <span className="text-gray-700 flex-auto min-w-0 break-words sm:flex-1 sm:truncate font-medium">{sub.name}</span>
              <span className="ml-auto flex items-center sm:contents">
                <SourceToggle source={sub.source} apiPath={`/api/finances/subscriptions/${sub.id}`} />
                <span className="text-gray-900 font-medium ml-2 whitespace-nowrap sm:ml-3">{fmt(sub.amount)}</span>
                {/* On a touch screen both ask first, saying what they do — the titles never show there. */}
                <button
                  onClick={() => handleCancel(sub)}
                  title="Cancel from next month"
                  aria-label={`Cancel ${sub.name} from next month`}
                  className={`${ROW_ICON_BTN} hover:text-orange-500 sm:ml-2`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(sub)}
                  title="Delete permanently"
                  aria-label={`Delete ${sub.name} permanently`}
                  className={`${ROW_END_ICON_BTN} ml-1 hover:text-red-500`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
          {inactive.length > 0 && (
            <>
              {active.length > 0 && <div className="pt-1" />}
              {inactive.map((sub) => (
                <div key={sub.id} className="flex flex-wrap items-center justify-between gap-y-1 py-1.5 px-3 rounded-lg text-sm opacity-40 sm:flex-nowrap">
                  <span className="text-gray-500 flex-auto min-w-0 break-words sm:flex-1 sm:truncate line-through">{sub.name}</span>
                  <span className="ml-auto flex items-center sm:contents">
                    <span className="text-gray-500 ml-2 whitespace-nowrap sm:ml-3">{fmt(sub.amount)}</span>
                    <button
                      onClick={() => handleDelete(sub)}
                      title="Delete permanently"
                      aria-label={`Delete ${sub.name} permanently`}
                      className={`${ROW_END_ICON_BTN} ml-1 hover:text-red-500 sm:ml-3`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
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
