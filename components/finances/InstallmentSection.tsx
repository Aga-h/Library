"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Installment } from "@prisma/client";
import type { FundSource } from "@/lib/fund-sources";
import {
  MAX_INSTALLMENTS, MIN_INSTALLMENTS, addMonths, installmentAmounts, lastMonth, planState, totalFromEach,
} from "@/lib/installments";
import { SourcePicker, SourceToggle } from "@/components/finances/SourceTag";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = ({ year, month }: { year: number; month: number }) => `${MONTHS[month - 1]} ${year}`;

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

const fieldCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

/** How far back a purchase already being paid can start, and how far ahead a new one. */
const MONTHS_BACK = 36;
const MONTHS_AHEAD = 3;

interface Props {
  installments: Installment[];
  year: number;
  month: number;
}

/**
 * Purchases paid in installments (taksit). Each month takes its share from the card it was put on,
 * like a subscription — and stops by itself after the last one.
 */
export default function InstallmentSection({ installments, year, month }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  // The price as quoted: "12.000 ₺ in 6" or "6 × 2.000 ₺".
  const [per, setPer] = useState<"total" | "each">("total");
  const [count, setCount] = useState("6");
  // The first installment: the month on screen, or earlier for one already being paid.
  const [start, setStart] = useState(`${year}-${month}`);
  const [source, setSource] = useState<FundSource>("BASE");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const states = installments.map((p) => ({ plan: p, state: planState(p, year, month) }));
  const paying = states.filter((x) => x.state.phase === "paying");
  const upcoming = states.filter((x) => x.state.phase === "upcoming");
  const done = states.filter((x) => x.state.phase === "done");

  const startOptions = Array.from({ length: MONTHS_BACK + MONTHS_AHEAD + 1 }, (_, i) =>
    addMonths(year, month, MONTHS_AHEAD - i));

  // What the form would add, while it is being filled in.
  const n = Number(count);
  const amt = parseFloat(amount);
  const valid = Number.isInteger(n) && n >= MIN_INSTALLMENTS && n <= MAX_INSTALLMENTS && amt > 0;
  const total = valid ? (per === "total" ? Math.round(amt * 100) / 100 : totalFromEach(amt, n)) : 0;
  const [sy, sm] = start.split("-").map(Number);
  const preview = valid ? { amounts: installmentAmounts(total, n), last: lastMonth({ total, count: n, startYear: sy, startMonth: sm }) } : null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !valid) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/finances/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), total, count: n, startYear: sy, startMonth: sm, source }),
      });
      if (!res.ok) {
        setError("Couldn't add it — check the amount and the number of installments.");
        return;
      }
      setName("");
      setAmount("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(p: Installment) {
    if (!window.confirm(`Delete "${p.name}"? Every installment of it goes — from past months' balances too.`)) return;
    await fetch(`/api/finances/installments/${p.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  const thisMonth = paying.reduce((s, x) => s + (x.state.current?.amount ?? 0), 0);

  return (
    <div className="installments bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Installments</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 mb-4">
        <input type="text" placeholder="What (e.g. Phone)" value={name} onChange={(e) => setName(e.target.value)}
          aria-label="What was bought" maxLength={120} className={`${fieldCls} w-full`} required />
        <div className="flex flex-wrap gap-2">
          <input type="number" min="0.01" step="0.01" placeholder={per === "total" ? "Price" : "Each"}
            aria-label={per === "total" ? "Total price" : "Each installment"}
            value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldCls} w-28 flex-1 min-w-24`} required />
          <div role="radiogroup" aria-label="Amount is" className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg text-xs font-semibold">
            {(["total", "each"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={per === v} onClick={() => setPer(v)}
                className={`px-2.5 py-1 rounded-md transition-colors ${per === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                {v === "total" ? "Total" : "Each"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-500">
            <span aria-hidden>×</span>
            <input type="number" min={MIN_INSTALLMENTS} max={MAX_INSTALLMENTS} step="1" value={count}
              onChange={(e) => setCount(e.target.value)} aria-label="Number of installments"
              className={`${fieldCls} w-16`} required />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <span className="flex-shrink-0">First one</span>
          <select value={start} onChange={(e) => setStart(e.target.value)} className={`${fieldCls} flex-1`}>
            {startOptions.map((o) => (
              <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                {label(o)}{o.year === year && o.month === month ? " (this month)" : ""}
              </option>
            ))}
          </select>
        </label>
        <SourcePicker value={source} onChange={setSource} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 tabular-nums" aria-live="polite">
            {preview
              ? <>{n} × {fmt(preview.amounts[n - 1])}{preview.amounts[0] !== preview.amounts[n - 1] && <> (first {fmt(preview.amounts[0])})</>} · until {label(preview.last)}</>
              : `${MIN_INSTALLMENTS}–${MAX_INSTALLMENTS} monthly installments`}
          </p>
          <button type="submit" disabled={adding || isPending || !valid || !name.trim()}
            className="flex flex-shrink-0 items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </form>

      {installments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No installment purchases yet.</p>
      ) : (
        <div className="space-y-1">
          {paying.map(({ plan, state }) => (
            <div key={plan.id} className="installment-row py-2 px-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 flex-1 truncate font-medium">{plan.name}</span>
                <span className="installment-count ml-2 text-[11px] font-semibold text-gray-500 tabular-nums"
                  aria-label={`installment ${state.current!.number} of ${plan.count}`}>
                  {state.current!.number}/{plan.count}
                </span>
                <SourceToggle source={plan.source} apiPath={`/api/finances/installments/${plan.id}`} />
                <span className="text-gray-900 font-medium ml-3 tabular-nums">{fmt(state.current!.amount)}</span>
                <button onClick={() => handleDelete(plan)} title="Delete — from past months too" aria-label={`Delete ${plan.name}`}
                  className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="installment-track mt-1.5 h-1 rounded-full bg-gray-200 overflow-hidden" aria-hidden>
                <div className="installment-fill h-full rounded-full bg-emerald-500" style={{ width: `${(state.paidCount / plan.count) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-gray-500 tabular-nums">
                {state.left > 0 ? <>{fmt(state.left)} left · last in {label(lastMonth(plan))}</> : "Last installment"}
                {" · "}{fmt(plan.total)} in all
              </p>
            </div>
          ))}

          {upcoming.map(({ plan }) => (
            <div key={plan.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm text-gray-500">
              <span className="flex-1 truncate">{plan.name}</span>
              <span className="ml-2 text-[11px]">from {label({ year: plan.startYear, month: plan.startMonth })}</span>
              <SourceToggle source={plan.source} apiPath={`/api/finances/installments/${plan.id}`} />
              <span className="ml-3 tabular-nums">{plan.count} × {fmt(installmentAmounts(plan.total, plan.count)[plan.count - 1])}</span>
              <button onClick={() => handleDelete(plan)} title="Delete" aria-label={`Delete ${plan.name}`}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {paying.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-900 px-3">
              <span>This month</span>
              <span className="tabular-nums">{fmt(thisMonth)}</span>
            </div>
          )}

          {done.length > 0 && (
            <details className="pt-1">
              <summary className="cursor-pointer px-3 py-1 text-xs font-semibold text-gray-400 hover:text-gray-600">
                Paid off ({done.length})
              </summary>
              {done.map(({ plan }) => (
                <div key={plan.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm opacity-50">
                  <span className="text-gray-500 flex-1 truncate">{plan.name}</span>
                  <span className="ml-2 text-[11px] text-gray-500">{label(lastMonth(plan))}</span>
                  <span className="text-gray-500 ml-3 tabular-nums">{fmt(plan.total)}</span>
                  <button onClick={() => handleDelete(plan)} title="Delete — from past months too" aria-label={`Delete ${plan.name}`}
                    className="ml-3 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
