export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fromKey, isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { MEAL_PLANS, mealDay, planRange, type Meal, type PlanNote } from "@/lib/meal-plan";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

const longDate = (key: DateKey) => LONG_DATE.format(fromKey(key));
const kcal = (n: number) => n.toLocaleString("en-US");

/** "22–31 October", or "26 October – 1 November" across a month end. */
function rangeLabel(first: DateKey, last: DateKey): string {
  const day = (key: DateKey) => Number(key.slice(8));
  const month = (key: DateKey) => MONTH.format(fromKey(key));
  return first.slice(0, 7) === last.slice(0, 7)
    ? `${day(first)}–${day(last)} ${month(last)}`
    : `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}

export default async function DietPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayKey();
  const { date: raw } = await searchParams;
  const date: DateKey = raw && isDateKey(raw) ? raw : today;
  const isToday = date === today;
  const found = mealDay(date);
  const title = isToday ? "Today's meals" : date === addDays(today, 1) ? "Tomorrow's meals" : "Meals";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {longDate(date)}
            {found && ` · ${found.day.kind} day`}
            {found?.day.occasion && ` · ${found.day.occasion}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/self-care?date=${addDays(date, -1)}`} aria-label="Previous day"
            className="p-2 max-sm:p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link href={`/self-care?date=${addDays(date, 1)}`} aria-label="Next day"
            className="p-2 max-sm:p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
          {!isToday && (
            <Link href="/self-care"
              className="px-3 py-2 max-sm:py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
              Today
            </Link>
          )}
        </div>
      </div>

      {!found ? (
        <section className="bg-white border border-gray-200 rounded-xl px-4 py-4 space-y-1 text-sm text-gray-500">
          <p className="font-semibold text-gray-900">No meal plan for {isToday ? "today" : "this day"}.</p>
          {MEAL_PLANS.map((plan) => {
            const { first, last } = planRange(plan);
            return (
              <p key={plan.title}>
                <Link href={`/self-care?date=${first}`} className="font-semibold text-gray-900 underline underline-offset-2">
                  {plan.title}
                </Link>
                {" "}covers {rangeLabel(first, last)}.
              </p>
            );
          })}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="kcal" value={kcal(found.day.total.kcal)} hint={`target ${kcal(found.plan.target[found.day.kind])}`} />
            <Tile label="protein" value={`~${found.day.total.protein} g`} />
            <Tile label="water" value={`${found.plan.water[found.day.kind]} L`} hint={found.plan.waterNote} />
          </div>

          {found.day.note && (
            <p className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">{found.day.note}</p>
          )}

          <Meals meals={found.day.meals} />

          {found.day.home && (
            <details>
              <Summary>Weekends at home</Summary>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">{found.plan.home.intro}</p>
                <Meals meals={found.plan.home.meals} total={found.plan.home.total} estimate />
                <Notes notes={found.plan.home.tips} />
              </div>
            </details>
          )}

          <details>
            <Summary>Rules</Summary>
            <Notes notes={found.plan.rules} />
          </details>
        </>
      )}
    </div>
  );
}

/** A plan's table. `estimate` marks every figure "~", for the at-home day. */
function Meals({ meals, total, estimate = false }: { meals: Meal[]; total?: { kcal: number; protein: number }; estimate?: boolean }) {
  const figures = (k: number | null, protein: number | null) =>
    k === null ? null : `${estimate ? "~" : ""}${kcal(k)} kcal${protein === null ? "" : ` · ~${protein} g protein`}`;
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {meals.map((meal, i) => (
        <div key={i} className="px-4 py-3 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{meal.time}</p>
          <p className="text-sm text-gray-900 break-words mt-0.5 sm:mt-0">{meal.what}</p>
          {meal.kcal !== null && (
            <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap mt-1 sm:mt-0 sm:text-right">{figures(meal.kcal, meal.protein)}</p>
          )}
        </div>
      ))}
      {total && (
        <div className="flex items-baseline justify-between gap-4 px-4 py-3 bg-gray-50 rounded-b-xl">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{figures(total.kcal, total.protein)}</p>
        </div>
      )}
    </div>
  );
}

function Notes({ notes }: { notes: PlanNote[] }) {
  return (
    <ul className="space-y-2 text-sm text-gray-600">
      {notes.map((n) => (
        <li key={n.lead}><span className="font-semibold text-gray-900">{n.lead}</span> {n.text}</li>
      ))}
    </ul>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="cursor-pointer py-2.5 sm:py-1 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wide hover:text-gray-600">
      {children}
    </summary>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 max-sm:px-3 py-3">
      <p className="text-2xl max-sm:text-xl font-bold text-gray-900 tabular-nums break-words">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}
