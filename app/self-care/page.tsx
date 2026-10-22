export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fromKey, isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { MEAL_PLANS, mealDay, planRange } from "@/lib/meal-plan";
import { dayTracking } from "@/lib/meal-plan-service";
import DayTracker from "@/components/self-care/DayTracker";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

const longDate = (key: DateKey) => LONG_DATE.format(fromKey(key));

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
  // Ticks and water are for today and the days before it; a day ahead only shows its plan.
  const tracking = found && date <= today ? await dayTracking(date) : null;
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
        <DayTracker key={date} date={date} day={found.day} tracking={tracking} waiting={date <= today && tracking === null}
          plan={{ target: found.plan.target, water: found.plan.water, waterNote: found.plan.waterNote, home: found.plan.home, rules: found.plan.rules }} />
      )}
    </div>
  );
}
