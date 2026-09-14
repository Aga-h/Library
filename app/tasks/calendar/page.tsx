export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { syncTasks, tasksBetween } from "@/lib/task-service";
import { dayVerdict, toModuleView, toTaskView } from "@/lib/tasks";
import { addDaysToKey, formatDayShort, isDayKey, startOfWeekKey, todayKey, weekKeys } from "@/lib/time";
import WeekCalendar from "@/components/tasks/WeekCalendar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await syncTasks();

  const { week } = await searchParams;
  const today = todayKey();
  const anchor = week && isDayKey(week) ? week : today;
  const days = weekKeys(anchor);

  const [tasks, modules, weekXp] = await Promise.all([
    tasksBetween(days[0], days[6]),
    db.module.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    db.xpAward.aggregate({
      where: { task: { day: { gte: days[0], lte: days[6] } } },
      _sum: { amount: true },
    }),
  ]);

  const verdicts = days.map((day) => dayVerdict(tasks.filter((t) => t.day === day)));
  const lit = verdicts.filter((v) => v.outcome === "LIT").length;
  const extinguished = verdicts.filter((v) => v.outcome === "EXTINGUISHED").length;

  const prevWeek = addDaysToKey(days[0], -7);
  const nextWeek = addDaysToKey(days[0], 7);
  const isCurrentWeek = days[0] === startOfWeekKey(today);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDayShort(days[0])} – {formatDayShort(days[6])}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tasks/calendar?week=${prevWeek}`}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            href="/tasks/calendar"
            className={`px-3 py-2 border rounded-lg text-sm font-semibold transition-colors ${
              isCurrentWeek
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            This week
          </Link>
          <Link
            href={`/tasks/calendar?week=${nextWeek}`}
            className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tasks booked" value={tasks.length} />
        <Stat label="Days lit" value={lit} />
        <Stat label="Days extinguished" value={extinguished} />
        <Stat label="XP this week" value={(weekXp._sum.amount ?? 0).toLocaleString()} />
      </div>

      <WeekCalendar
        days={days}
        today={today}
        tasks={tasks.map(toTaskView)}
        modules={modules.map(toModuleView)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
