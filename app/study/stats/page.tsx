export const dynamic = "force-dynamic";

import Link from "next/link";
import { Flame, Timer } from "lucide-react";
import { levelFromXp, xpForLevel } from "@/lib/leveling";
import { STATS, STAT_META } from "@/lib/stats";
import { recentSessions, statXpTotals, studyTotals } from "@/lib/study-service";
import { formatDuration } from "@/lib/study";
import { todayKey } from "@/lib/dates";
import LevelBar from "@/components/study/LevelBar";
import StatBadges from "@/components/study/StatBadges";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** "September 2026" from a YYYY-MM-01 key. */
function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default async function StatsPage() {
  const now = new Date();
  const today = todayKey(now);

  const [totals, study, recent] = await Promise.all([
    statXpTotals(),
    studyTotals(today, now),
    recentSessions(8),
  ]);

  const totalXp = STATS.reduce((sum, stat) => sum + (totals[stat] ?? 0), 0);
  const totalLevel = STATS.reduce((sum, stat) => sum + levelFromXp(totals[stat] ?? 0), 0);

  const ranked = [...STATS].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
  const best = ranked[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stats</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Every stat starts at 0 and climbs a natural-log curve — quick at first, then slower forever.
          </p>
        </div>
        <div className="bg-gray-900 text-white rounded-xl px-5 py-3 text-right">
          <p className="text-3xl font-bold leading-none">{totalLevel}</p>
          <p className="text-[11px] text-gray-400 font-semibold tracking-wide mt-1">TOTAL LEVEL</p>
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Study time</h3>
          <span className="text-xs text-gray-400 font-normal">every session, module or not</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StudyTile label="Today" value={study.day} />
          <StudyTile label="This week" value={study.week} hint={`since Mon ${study.weekStart.slice(8)}`} />
          <StudyTile label="This month" value={study.month} hint={monthLabel(study.monthStart)} />
          <StudyTile label="All time" value={study.total} accent />
        </div>
      </section>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <Flame className="w-4 h-4 text-gray-300 mb-1.5" />
          <p className="text-xl font-bold text-gray-900">{totalXp.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total XP</p>
        </div>
        {totalXp > 0 && (
          <p className="text-sm text-gray-500 flex-1 min-w-60">
            Strongest stat: <span className="font-semibold text-gray-900">{STAT_META[best].label}</span> at level{" "}
            {levelFromXp(totals[best] ?? 0)} — next level at{" "}
            {xpForLevel(levelFromXp(totals[best] ?? 0) + 1).toLocaleString()} XP.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {STATS.map((stat) => (
          <LevelBar key={stat} stat={stat} xp={totals[stat] ?? 0} />
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Recent sessions</h3>
        {recent.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-500">
              Nothing studied yet.{" "}
              <Link href="/study" className="font-semibold text-gray-900 underline">Start a session</Link>{" "}
              and every minute pays a stat.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {recent.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {session.moduleTitle ?? "Free study"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session.date} · {formatDuration(session.seconds)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatBadges stats={session.stats} size="xs" />
                  <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                    +{session.xp.toLocaleString()} XP
                    {session.stats.length > 1 && <span className="font-normal text-gray-400"> each</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StudyTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${accent ? "bg-gray-900 border-gray-900" : "bg-gray-50 border-gray-100"}`}>
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-white" : "text-gray-900"}`}>
        {formatDuration(value)}
      </p>
      <p className={`text-xs mt-0.5 ${accent ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      {hint && <p className={`text-[11px] mt-0.5 ${accent ? "text-gray-500" : "text-gray-400"}`}>{hint}</p>}
    </div>
  );
}
