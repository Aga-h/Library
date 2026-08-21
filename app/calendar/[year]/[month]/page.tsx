export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, GraduationCap } from "lucide-react";
import { db } from "@/lib/db";
import { parseMonthParams } from "@/lib/month-params";
import { loadContext } from "@/lib/calendar";
import { deriveKind } from "@/lib/calendar-shuffle";
import {
  monthGrid, keyMonth, isWeekend, todayKey, fromKey, toKey, type DateKey,
} from "@/lib/calendar-dates";
import DealButtons from "@/components/calendar/DealButtons";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function prevMonth(y: number, m: number) { return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }; }
function nextMonth(y: number, m: number) { return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }; }

function formatMinute(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface PageProps { params: Promise<{ year: string; month: string }> }

export default async function CalendarMonthPage({ params }: PageProps) {
  const parsed = parseMonthParams(await params);
  if (!parsed) notFound();
  const { year, month } = parsed;

  const grid = monthGrid(year, month);
  const [context, days] = await Promise.all([
    loadContext(),
    db.calendarDay.findMany({
      where: { date: { gte: fromKey(grid[0]), lte: fromKey(grid[grid.length - 1]) } },
      include: { plan: { include: { activities: { orderBy: { startMinute: "asc" }, take: 3 } } } },
    }),
  ]);

  const byDate = new Map(days.map((d) => [toKey(d.date), d]));
  const kindOf = (d: DateKey) =>
    deriveKind(d, { isWeekend, terms: context.terms, daysOff: context.daysOff });

  const today = todayKey();
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Link href={`/calendar/${prev.y}/${prev.m}`} aria-label="Previous month"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{MONTHS[month - 1]} {year}</h1>
          <Link href={`/calendar/${next.y}/${next.m}`} aria-label="Next month"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
        <DealButtons year={year} month={month} />
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Link href="/calendar/days" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
          <CalendarDays className="w-4 h-4" /> Days
        </Link>
        <Link href="/calendar/terms" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
          <GraduationCap className="w-4 h-4" /> School terms
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-500 text-center">{d}</div>
        ))}
        {grid.map((key) => {
          const outside = keyMonth(key) !== month;
          const kind = kindOf(key);
          const entry = byDate.get(key);
          const plan = entry?.plan ?? null;
          // A plan can end up on a date of the wrong kind if a term is edited after dealing.
          // Surfacing that beats silently showing a school day on a Sunday.
          const mismatch = plan !== null && plan.kind !== kind;

          return (
            <Link
              key={key}
              href={`/calendar/day/${key}`}
              className={`min-h-24 p-2 flex flex-col gap-1 transition-colors ${
                outside ? "bg-gray-50/60" : kind === "SCHOOL" ? "bg-white" : "bg-amber-50/40"
              } hover:bg-gray-100`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${
                  key === today ? "bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  : outside ? "text-gray-300" : "text-gray-500"
                }`}>
                  {Number(key.slice(8, 10))}
                </span>
                {!outside && kind === "SCHOOL" && (
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">School</span>
                )}
              </div>
              {plan && (
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs font-semibold leading-tight ${mismatch ? "text-red-600" : "text-gray-900"}`}>
                    {plan.name}
                    {mismatch && " ⚠"}
                  </span>
                  {plan.activities.map((a) => (
                    <span key={a.id} className="text-[10px] text-gray-500 leading-tight truncate">
                      {formatMinute(a.startMinute)} {a.title}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Weekends are always holidays. A ⚠ marks a day sitting on a date whose kind has since changed.
      </p>
    </div>
  );
}
