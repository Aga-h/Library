export const dynamic = "force-dynamic";

import { levelFromXp } from "@/lib/leveling";
import { STATS } from "@/lib/stats";
import { addDays, fromKey, todayKey, weekStartOf, type DateKey } from "@/lib/dates";
import {
  listModules,
  openSession,
  sessionsForDate,
  statXpTotals,
  studyTotals,
  toRunningView,
  weekSecondsByModule,
  weeklyGoalMinutes,
} from "@/lib/study-service";
import SessionBoard from "@/components/study/SessionBoard";
import WeeklyGoals from "@/components/study/WeeklyGoals";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "22–28 Sep", or "29 Sep – 5 Oct" across a month. */
function weekLabel(start: DateKey): string {
  const end = addDays(start, 6);
  const [s, e] = [fromKey(start), fromKey(end)];
  const sm = MONTHS[s.getUTCMonth()], em = MONTHS[e.getUTCMonth()];
  return sm === em
    ? `${s.getUTCDate()}–${e.getUTCDate()} ${em}`
    : `${s.getUTCDate()} ${sm} – ${e.getUTCDate()} ${em}`;
}

export default async function StudyPage() {
  // One clock for the whole render: the board needs the same instant the server used.
  const now = new Date();
  const today = todayKey(now);

  const [running, modules, sessions, totals, week, byModule, goalMinutes] = await Promise.all([
    openSession(),
    listModules(),
    sessionsForDate(today),
    statXpTotals(),
    studyTotals(today, now),
    weekSecondsByModule(today, now),
    weeklyGoalMinutes(),
  ]);

  const totalLevel = STATS.reduce((sum, stat) => sum + levelFromXp(totals[stat] ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Study</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Start a session and say what you are studying. Every minute pays one XP to each stat
            that module trains.
          </p>
        </div>
        <div className="bg-gray-900 text-white rounded-xl px-5 py-3 text-right">
          <p className="text-3xl font-bold leading-none">{totalLevel}</p>
          <p className="text-[11px] text-gray-400 font-semibold tracking-wide mt-1">TOTAL LEVEL</p>
        </div>
      </div>

      <WeeklyGoals
        today={today}
        weekLabel={weekLabel(weekStartOf(today))}
        overall={{ goalMinutes, doneSeconds: week.week }}
        // Every module you can study gets a row, goal or not. One with no stats cannot be started,
        // so a goal for it could never move.
        modules={modules
          .filter((m) => m.stats.length > 0)
          .map((m) => ({
            id: m.id,
            title: m.title,
            goalMinutes: m.weeklyGoalMinutes,
            doneSeconds: byModule[m.id] ?? 0,
          }))}
      />

      <SessionBoard
        running={running ? toRunningView(running) : null}
        modules={modules.map((m) => ({
          id: m.id, title: m.title, notes: m.notes, stats: m.stats, weeklyGoalMinutes: m.weeklyGoalMinutes,
        }))}
        today={sessions}
        weekSeconds={byModule}
        serverNow={now.getTime()}
      />
    </div>
  );
}
