import { Flame, Scale } from "lucide-react";
import { DAY_OUTCOME_LABEL, type DayVerdict } from "@/lib/tasks";

const STYLES: Record<DayVerdict["outcome"], string> = {
  EMPTY: "bg-gray-50 text-gray-400 border-gray-200",
  PENDING: "bg-sky-50 text-sky-700 border-sky-200",
  LIT: "bg-amber-50 text-amber-700 border-amber-200",
  EVEN: "bg-gray-50 text-gray-600 border-gray-200",
  EXTINGUISHED: "bg-gray-900 text-gray-100 border-gray-900",
};

/** A day burns while completions lead; more failures and it goes out. */
export default function DayVerdictBadge({
  verdict,
  showCounts = true,
  future = false,
}: {
  verdict: DayVerdict;
  showCounts?: boolean;
  /** A day still ahead of us — nothing has been judged yet. */
  future?: boolean;
}) {
  const Icon = verdict.outcome === "EVEN" ? Scale : Flame;
  const dim = verdict.outcome === "EXTINGUISHED" || verdict.outcome === "EMPTY";
  const label = future && verdict.outcome === "PENDING" ? "Booked" : DAY_OUTCOME_LABEL[verdict.outcome];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold ${
        future && verdict.outcome === "PENDING" ? "bg-gray-50 text-gray-500 border-gray-200" : STYLES[verdict.outcome]
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${dim || (future && verdict.outcome === "PENDING") ? "opacity-60" : ""}`} />
      {label}
      {showCounts && verdict.completed + verdict.failed + verdict.open > 0 && (
        <span className="font-normal opacity-80">
          {verdict.completed}✓ · {verdict.failed}✕
          {verdict.open > 0 ? ` · ${verdict.open} open` : ""}
        </span>
      )}
    </span>
  );
}
