export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookA, ChevronLeft, ChevronRight, Flame, GraduationCap, Timer, TrendingUp } from "lucide-react";
import { dailyReview } from "@/lib/review-service";
import { formatDuration } from "@/lib/study";
import { addDays, fromKey, isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { STAT_META } from "@/lib/stats";
import StatBadges from "@/components/study/StatBadges";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function longDate(key: DateKey): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${WEEKDAYS[fromKey(key).getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const now = new Date();
  const today = todayKey(now);
  const { date: raw } = await searchParams;
  // Never a future date: there is nothing to review there yet.
  const date: DateKey = raw && isDateKey(raw) && raw <= today ? (raw as DateKey) : today;
  const r = await dailyReview(date, now);

  const isToday = date === today;
  const levelsGained = r.xp.totalLevelAfter - r.xp.totalLevelBefore;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{isToday ? "Today's review" : "Review"}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{longDate(date)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/study/review?date=${addDays(date, -1)}`} aria-label="Previous day"
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          {!isToday && (
            <>
              <Link href={`/study/review?date=${addDays(date, 1)}`} aria-label="Next day"
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/study/review"
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                Today
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Timer} label="Studied" value={formatDuration(r.study.seconds)}
          hint={r.study.running ? "incl. a session still running" : `${r.study.sessions} session${r.study.sessions === 1 ? "" : "s"}`} accent />
        <Tile icon={Timer} label="This week" value={formatDuration(r.study.weekSeconds)} hint={`since Mon ${r.study.weekStart.slice(8)}`} />
        <Tile icon={Flame} label="Streak"
          value={`${r.study.streak.days} day${r.study.streak.days === 1 ? "" : "s"}`}
          hint={r.study.streak.includesToday ? "including today" : r.study.streak.days > 0 ? (isToday ? "study today to keep it" : "ended the day before") : "no streak"}
          warn={!r.study.streak.includesToday && r.study.streak.days > 0 && isToday} />
        <Tile icon={TrendingUp} label="XP earned" value={r.xp.total.toLocaleString()}
          hint={levelsGained > 0 ? `+${levelsGained} level${levelsGained === 1 ? "" : "s"} · total ${r.xp.totalLevelAfter}` : `total level ${r.xp.totalLevelAfter}`} />
      </div>

      {/* What was studied */}
      <Section title="What you studied">
        {r.study.byModule.length === 0 && !r.study.running ? (
          <Empty>Nothing studied {isToday ? "yet today" : "that day"}.</Empty>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {r.study.running && (
              <Row title={`${r.study.running.title ?? "Free study"} — still running`} sub={`${formatDuration(r.study.running.seconds)} so far, paid when you stop`}
                stats={r.study.running.stats} />
            )}
            {r.study.byModule.map((m) => (
              <Row key={m.title ?? "free"} title={m.title ?? "Free study"}
                sub={`${formatDuration(m.seconds)} · ${m.sessions} session${m.sessions === 1 ? "" : "s"}`} stats={m.stats} />
            ))}
          </div>
        )}
      </Section>

      {/* Stats that moved */}
      {r.xp.gains.length > 0 && (
        <Section title="Stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {r.xp.gains.map((g) => {
              const meta = STAT_META[g.stat];
              const up = g.levelAfter > g.levelBefore;
              return (
                <div key={g.stat} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${up ? `${meta.bg} ${meta.border}` : "bg-white border-gray-200"}`}>
                  <span className={`text-sm font-semibold ${up ? meta.text : "text-gray-900"}`}>{meta.label}</span>
                  <span className="text-sm text-gray-600 tabular-nums">
                    +{g.xp.toLocaleString()} XP
                    {up ? <span className={`font-bold ${meta.text}`}> · Lv {g.levelBefore} → {g.levelAfter}</span>
                        : <span className="text-gray-400"> · Lv {g.levelAfter}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* AP */}
      <Section title="AP units" icon={GraduationCap}>
        {r.ap.completed.length > 0 ? (
          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-3">
            {r.ap.completed.map((u) => (
              <li key={`${u.course}-${u.number}`} className="px-4 py-3 text-sm">
                <span className="font-semibold text-gray-900">{u.course}</span>
                <span className="text-gray-500"> · Unit {u.number}: {u.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 mb-3">No units ticked off {isToday ? "today" : "that day"}.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {r.ap.progress.map((c) => (
            <div key={c.course} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-900">{c.course}</span>
                <span className="text-gray-500 tabular-nums">{c.done}/{c.total}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Vocabulary */}
      <Section title="SAT vocabulary" icon={BookA}>
        {r.vocab.answered === 0 ? (
          <Empty>No questions answered {isToday ? "yet today" : "that day"}.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <Tile label="Answered" value={String(r.vocab.answered)} hint={r.vocab.accuracy === null ? undefined : `${r.vocab.accuracy}% correct`} />
              <Tile label="Done" value={String(r.vocab.done)} />
              <Tile label="Ambiguous" value={String(r.vocab.ambiguous)} />
              <Tile label="To Review" value={String(r.vocab.toReview)} warn={r.vocab.toReview > 0} />
            </div>
            {r.vocab.toReviewWords.length > 0 && (
              <div className="bg-white border border-red-200 rounded-xl divide-y divide-gray-50">
                <p className="px-4 py-2.5 text-xs font-bold text-red-700 uppercase tracking-wide">Look at these again</p>
                {r.vocab.toReviewWords.map((w, i) => (
                  <div key={`${w.word}-${i}`} className="px-4 py-2.5">
                    <p className="text-sm font-semibold text-gray-900">{w.word}</p>
                    <p className="text-xs text-gray-500">{w.meaning}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {r.vocab.run && (
          <p className="text-xs text-gray-500 mt-3">
            Current test: {r.vocab.run.answered} of {r.vocab.run.total} answered.
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Timer; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
        {Icon && <Icon className="w-3.5 h-3.5" />}{title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">{children}</p>;
}

function Row({ title, sub, stats }: { title: string; sub: string; stats: Parameters<typeof StatBadges>[0]["stats"] }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{title}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      <StatBadges stats={stats} size="xs" />
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint, accent = false, warn = false }: {
  icon?: typeof Timer; label: string; value: string; hint?: string; accent?: boolean; warn?: boolean;
}) {
  const box = accent ? "bg-gray-900 border-gray-900" : warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200";
  return (
    <div className={`rounded-xl px-4 py-3 border ${box}`}>
      {Icon && <Icon className={`w-4 h-4 mb-1.5 ${accent ? "text-gray-500" : "text-gray-300"}`} />}
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-white" : "text-gray-900"}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${accent ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      {hint && <p className={`text-[11px] mt-0.5 ${accent ? "text-gray-500" : warn ? "text-amber-700" : "text-gray-400"}`}>{hint}</p>}
    </div>
  );
}
