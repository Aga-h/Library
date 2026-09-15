export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarDays, Flame, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { levelFromXp } from "@/lib/leveling";
import { STATS } from "@/lib/stats";
import { statXpTotals, syncTasks, tasksForDate } from "@/lib/task-service";
import { dayVerdict, isTrackable, toTaskView } from "@/lib/tasks";
import { fromKey, isDateKey, todayKey, type DateKey } from "@/lib/calendar-dates";
import DayVerdictBadge from "@/components/tasks/DayVerdictBadge";
import TodayBoard from "@/components/tasks/TodayBoard";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default async function TasksTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const now = await syncTasks();
  const { date } = await searchParams;
  const key: DateKey = date && isDateKey(date) ? (date as DateKey) : todayKey();

  const [tasks, totals, earnedToday, entry] = await Promise.all([
    tasksForDate(key),
    statXpTotals(),
    db.xpAward.aggregate({ where: { task: { date: fromKey(key) } }, _sum: { amount: true } }),
    db.calendarDay.findUnique({
      where: { date: fromKey(key) },
      include: { plan: { include: { modules: { include: { module: true } } } } },
    }),
  ]);

  const verdict = dayVerdict(tasks);
  const totalLevel = STATS.reduce((sum, stat) => sum + levelFromXp(totals[stat] ?? 0), 0);

  const plan = entry?.plan ?? null;
  const placed = plan?.modules.map((p) => p.module) ?? [];
  // Modules in today's plan that cannot be tasks, so the page can say why rather than just
  // leaving them out.
  const skipped = placed.filter((m) => !isTrackable(m));

  const [y, m, d] = key.split("-").map(Number);
  const isToday = key === todayKey();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{isToday ? "Today" : "That day"}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {WEEKDAYS[fromKey(key).getUTCDay()]}, {d} {MONTHS[m - 1]} {y}
            {plan && <> · <span className="text-gray-700">{plan.name}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/tasks/stats"
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors">
            <Sparkles className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total level</span>
            <span className="text-sm font-bold text-gray-900">{totalLevel}</span>
          </Link>
          <Link href={`/calendar/day/${key}`}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <CalendarDays className="w-4 h-4" /> This day in the calendar
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <DayVerdictBadge verdict={verdict} />
          <p className="text-sm text-gray-500">
            {verdict.outcome === "EXTINGUISHED"
              ? "More failures than completions — this day is out."
              : verdict.outcome === "LIT"
                ? "Completions lead. The day stays lit."
                : verdict.outcome === "EVEN"
                  ? "Completions and failures are level."
                  : verdict.outcome === "PENDING"
                    ? "Still in play."
                    : plan
                      ? "Nothing in this day trains a stat yet."
                      : "No day plan is dealt onto this date."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Flame className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-gray-900">
            {(earnedToday._sum.amount ?? 0).toLocaleString()}
          </span>
          XP earned
        </div>
      </div>

      {!plan && (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No day dealt onto this date</p>
          <p className="text-sm text-gray-500 mt-1">
            Tasks come from the day plan on the calendar — deal a day, and its modules show up here.
          </p>
          <Link href="/calendar"
            className="inline-flex items-center gap-2 mt-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <CalendarDays className="w-4 h-4" /> Open the calendar
          </Link>
        </div>
      )}

      <TodayBoard tasks={tasks.map((t) => toTaskView(t, key))} serverNow={now.getTime()} />

      {skipped.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Also in this day, but not tracked
          </p>
          <ul className="space-y-1">
            {skipped.map((mod) => (
              <li key={mod.id} className="text-sm text-gray-500">
                <span className="text-gray-900">{mod.title}</span>{" "}
                — {mod.endMinute == null ? "no end time" : "no stats picked"}
              </li>
            ))}
          </ul>
          <Link href="/calendar/modules" className="inline-block mt-3 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            Set them up in Modules →
          </Link>
        </div>
      )}
    </div>
  );
}
