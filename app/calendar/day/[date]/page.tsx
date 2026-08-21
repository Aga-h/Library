export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { loadContext } from "@/lib/calendar";
import { deriveKind } from "@/lib/calendar-shuffle";
import { fromKey, isDateKey, isWeekend, dayOfWeek, type DateKey } from "@/lib/calendar-dates";
import AssignDay from "@/components/calendar/AssignDay";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function formatMinute(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface PageProps { params: Promise<{ date: string }> }

export default async function CalendarDayPage({ params }: PageProps) {
  const { date } = await params;
  if (!isDateKey(date)) notFound();
  const key = date as DateKey;

  const [context, entry, plans] = await Promise.all([
    loadContext(),
    db.calendarDay.findUnique({
      where: { date: fromKey(key) },
      include: { plan: { include: { activities: { orderBy: { startMinute: "asc" } } } } },
    }),
    db.dayPlan.findMany({ select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } }),
  ]);

  const kind = deriveKind(key, { isWeekend, terms: context.terms, daysOff: context.daysOff });
  const plan = entry?.plan ?? null;
  const mismatch = plan !== null && plan.kind !== kind;
  const [y, m, d] = key.split("-").map(Number);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/calendar/${y}/${m}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to {MONTHS[m - 1]} {y}
      </Link>

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">{d} {MONTHS[m - 1]} {y}</h1>
        <span className="text-sm text-gray-500">{WEEKDAYS[dayOfWeek(key)]}</span>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        {kind === "SCHOOL" ? "A school day." : "A holiday."}{" "}
        {isWeekend(key)
          ? "Weekends are always holidays."
          : context.daysOff.has(key)
            ? "You marked this date as a day off."
            : kind === "SCHOOL"
              ? "It falls inside a school term."
              : "It falls outside every school term."}
      </p>

      {mismatch && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
          This date holds a {plan!.kind.toLowerCase()} day, but the date is a {kind.toLowerCase()} —
          the terms must have changed after it was dealt. Pick another day below, or leave it.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <AssignDay date={key} current={entry?.planId ?? null} options={plans} matchingKind={kind} />
      </div>

      {plan && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{plan.name}</h2>
          {plan.activities.length === 0 ? (
            <p className="text-sm text-gray-400">This day has no activities yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {plan.activities.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="text-gray-400 tabular-nums flex-shrink-0">
                    {formatMinute(a.startMinute)}{a.endMinute != null && `–${formatMinute(a.endMinute)}`}
                  </span>
                  <span className="text-gray-900">{a.title}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/calendar/days/${plan.id}`} className="inline-block mt-4 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Edit this day →
          </Link>
        </div>
      )}
    </div>
  );
}
