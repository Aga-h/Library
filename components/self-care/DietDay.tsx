"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dayOfWeek, isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { MEAL_PLANS, mealDay, planRange } from "@/lib/meal-plan";
import type { DayTracking } from "@/lib/meal-plan-service";
import { loadDay } from "@/lib/diet-queue";
import DayTracker from "@/components/self-care/DayTracker";

// Spelled out rather than Intl: rendered on the server and again in the browser, the two must
// match letter for letter, and Node's and Safari's date formats differ by a comma.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const month = (key: DateKey) => MONTHS[Number(key.slice(5, 7)) - 1];
const longDate = (key: DateKey) => `${WEEKDAYS[dayOfWeek(key)]} ${Number(key.slice(8))} ${month(key)} ${key.slice(0, 4)}`;

/** "22–31 October", or "26 October – 1 November" across a month end. */
function rangeLabel(first: DateKey, last: DateKey): string {
  const day = (key: DateKey) => Number(key.slice(8));
  return first.slice(0, 7) === last.slice(0, 7)
    ? `${day(first)}–${day(last)} ${month(last)}`
    : `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}

/** A page rendered longer ago than this came from the offline cache, not the site. */
const FROM_CACHE_AFTER_MS = 5 * 60 * 1000;
/** The day in the address bar, if it names one. */
const askedDate = (): DateKey | null => {
  const raw = new URLSearchParams(window.location.search).get("date");
  return raw && isDateKey(raw) ? raw : null;
};

/**
 * The Diet page: one day of the plan, as the site rendered it. When the page came from the
 * offline cache instead — the home-screen app opened with the site out of reach — it may be
 * another day's, so it shows the day asked for (or today) from the plan bundled with the page,
 * with the last ticks and water this device heard from the site and whatever it has queued.
 */
export default function DietDay({ date, today, tracking, renderedAt }: {
  date: DateKey;
  today: DateKey;
  tracking: DayTracking | null;
  renderedAt: number;
}) {
  const [view, setView] = useState({ date, today, tracking, fromCache: false });

  useEffect(() => {
    if (Date.now() - renderedAt < FROM_CACHE_AFTER_MS) return;
    const now = todayKey();
    const shown = askedDate() ?? now;
    const ahead = shown > now;
    (ahead ? Promise.resolve(null) : loadDay(shown).catch(() => null)).then((saved) =>
      setView({ date: shown, today: now, tracking: ahead ? null : saved ?? { checked: [], water: [] }, fromCache: true })
    );
  }, [renderedAt]);

  // The app left open overnight: coming back to it on a new day shows the new day.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible" && !askedDate() && todayKey() !== view.date) window.location.reload();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [view.date]);

  const isToday = view.date === view.today;
  const found = mealDay(view.date);
  const title = isToday ? "Today's meals" : view.date === addDays(view.today, 1) ? "Tomorrow's meals" : "Meals";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {longDate(view.date)}
            {found && ` · ${found.day.kind} day`}
            {found?.day.occasion && ` · ${found.day.occasion}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/self-care?date=${addDays(view.date, -1)}`} aria-label="Previous day"
            className="p-2 max-sm:p-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link href={`/self-care?date=${addDays(view.date, 1)}`} aria-label="Next day"
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
        <DayTracker key={`${view.date}:${view.fromCache}`} date={view.date} day={found.day} tracking={view.tracking}
          fromCache={view.fromCache} waiting={!view.fromCache && view.date <= view.today && view.tracking === null}
          plan={{ target: found.plan.target, water: found.plan.water, waterNote: found.plan.waterNote, home: found.plan.home, rules: found.plan.rules }} />
      )}
    </div>
  );
}
