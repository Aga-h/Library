import { SOURCE_LABELS, type FundSource, type MonthBalances, type PotBalance } from "@/lib/fund-sources";

function fmt(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

/**
 * The month's money as two cards — Base (the monthly budget) and Extra (additional income) — each
 * with what is left on it, so you know which one to pay with; the overall totals underneath.
 */
export default function BudgetSummary({ balances }: { balances: MonthBalances }) {
  const { total } = balances;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PotCard source="BASE" pot={balances.base} incomingLabel="Budget" />
        <PotCard source="EXTRA" pot={balances.extra} incomingLabel="Extra income" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-1">
        <span>Available this month: <span className="font-medium text-gray-700">{fmt(total.available)}</span></span>
        <span aria-hidden>·</span>
        <span>Spent: <span className="font-medium text-gray-700">{fmt(total.spent)}</span></span>
        <span aria-hidden>·</span>
        <span>
          Left in total:{" "}
          <span className={`font-semibold ${total.left >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(total.left)}</span>
        </span>
      </div>
    </div>
  );
}

function PotCard({ source, pot, incomingLabel }: { source: FundSource; pot: PotBalance; incomingLabel: string }) {
  return (
    <div className={`fund-card fund-card-${source.toLowerCase()} bg-white rounded-xl border border-gray-200 p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden className={`w-2.5 h-2.5 rounded-full ${source === "BASE" ? "bg-sky-500" : "bg-violet-500"}`} />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{SOURCE_LABELS[source]}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${pot.left >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(pot.left)}</span>
        <span className="text-sm text-gray-400">left</span>
      </p>
      <p className="text-xs text-gray-500 mt-1.5">
        {incomingLabel} {fmt(pot.incoming)}
        {pot.carried !== 0 && <> · carried {pot.carried > 0 ? "+" : ""}{fmt(pot.carried)}</>}
        {" "}· spent {fmt(pot.spent)}
      </p>
    </div>
  );
}
