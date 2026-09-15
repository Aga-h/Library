export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarDays, Flame, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { levelFromXp } from "@/lib/leveling";
import { STATS } from "@/lib/stats";
import { statXpTotals, syncTasks, tasksForDay } from "@/lib/task-service";
import { dayVerdict, toTaskView } from "@/lib/tasks";
import { formatDayLong, todayKey } from "@/lib/time";
import DayVerdictBadge from "@/components/tasks/DayVerdictBadge";
import TodayBoard from "@/components/tasks/TodayBoard";

export default async function TasksTodayPage() {
  const now = await syncTasks();

  const day = todayKey();
  const [tasks, totals, earnedToday] = await Promise.all([
    tasksForDay(day),
    statXpTotals(),
    db.xpAward.aggregate({ where: { task: { day } }, _sum: { amount: true } }),
  ]);

  const verdict = dayVerdict(tasks);
  const totalLevel = STATS.reduce((sum, stat) => sum + levelFromXp(totals[stat] ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Today</h2>
          <p className="text-sm text-gray-500 mt-0.5">{formatDayLong(day)}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/tasks/stats"
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total level</span>
            <span className="text-sm font-bold text-gray-900">{totalLevel}</span>
          </Link>
          <Link
            href="/tasks/calendar"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <CalendarDays className="w-4 h-4" /> Calendar
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
                    : "Book a module on the calendar to start the day."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Flame className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-gray-900">
            {(earnedToday._sum.amount ?? 0).toLocaleString()}
          </span>
          XP earned today
        </div>
      </div>

      <TodayBoard tasks={tasks.map(toTaskView)} serverNow={now.getTime()} />
    </div>
  );
}
