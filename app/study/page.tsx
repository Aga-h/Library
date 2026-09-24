export const dynamic = "force-dynamic";

import { levelFromXp } from "@/lib/leveling";
import { STATS } from "@/lib/stats";
import { todayKey } from "@/lib/dates";
import {
  listModules,
  openSession,
  sessionsForDate,
  statXpTotals,
  toRunningView,
} from "@/lib/study-service";
import SessionBoard from "@/components/study/SessionBoard";

export default async function StudyPage() {
  // One clock for the whole render: the board needs the same instant the server used.
  const now = new Date();
  const today = todayKey(now);

  const [running, modules, sessions, totals] = await Promise.all([
    openSession(),
    listModules(),
    sessionsForDate(today),
    statXpTotals(),
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

      <SessionBoard
        running={running ? toRunningView(running) : null}
        modules={modules.map((m) => ({ id: m.id, title: m.title, notes: m.notes, stats: m.stats }))}
        today={sessions}
        serverNow={now.getTime()}
      />
    </div>
  );
}
