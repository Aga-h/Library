// Database side of the daily review. Pure assembly lives in lib/review.ts.

import { db } from "@/lib/db";
import { addDays, fromKey, toKey, type DateKey } from "@/lib/dates";
import { openSession, studyTotals } from "@/lib/study-service";
import { secondsBetween } from "@/lib/study";
import {
  apForDate,
  coarseWindow,
  groupByModule,
  onLocalDate,
  statGains,
  streakEndingOn,
  tallyVocab,
  totalLevel,
  type DailyReview,
} from "@/lib/review";

/** Cumulative XP per stat from every session dated on or before `date`. */
async function xpThrough(date: DateKey): Promise<Record<string, number>> {
  const rows = await db.xpAward.groupBy({
    by: ["stat"],
    where: { studySession: { date: { lte: fromKey(date) } } },
    _sum: { amount: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) out[row.stat] = row._sum.amount ?? 0;
  return out;
}

/** How far back a streak is counted. Past this it is simply "a year and more". */
const STREAK_LOOKBACK_DAYS = 400;

export async function dailyReview(date: DateKey, now: Date = new Date()): Promise<DailyReview> {
  const [sessions, running, totals, studiedDays, before, after, units, answers, run] =
    await Promise.all([
      db.studySession.findMany({
        where: { date: fromKey(date), endedAt: { not: null } },
        include: { module: { select: { title: true } } },
      }),
      openSession(),
      studyTotals(date, now),
      db.studySession.groupBy({
        by: ["date"],
        where: {
          date: { gte: fromKey(addDays(date, -STREAK_LOOKBACK_DAYS)), lte: fromKey(date) },
          seconds: { gt: 0 },
        },
      }),
      xpThrough(addDays(date, -1)),
      xpThrough(date),
      db.apUnit.findMany({
        include: { course: { select: { shortName: true } } },
        orderBy: [{ course: { position: "asc" } }, { number: "asc" }],
      }),
      db.vocabQuestion.findMany({
        where: { answeredAt: coarseWindow(date) },
        include: { meaning: { include: { word: true } } },
        orderBy: { answeredAt: "asc" },
      }),
      db.vocabRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { _count: { select: { questions: true } }, id: true },
      }),
    ]);

  // A session running right now counts as today's study — it just has not been paid yet.
  const runningToday = running && toKey(running.date) === date ? running : null;

  const studied = new Set(studiedDays.map((d) => toKey(d.date)));
  if (runningToday) studied.add(date);

  const gains = statGains(before, after);

  const runAnswered = run
    ? await db.vocabQuestion.count({ where: { runId: run.id, verdict: { not: null } } })
    : 0;

  const vocab = tallyVocab(
    onLocalDate(answers, date, (q) => q.answeredAt).map((q) => ({
      chosenId: q.chosenId,
      meaningId: q.meaningId,
      verdict: q.verdict,
      word: q.meaning.word.word,
      meaning: q.meaning.text,
    })),
  );

  return {
    date,
    generatedAt: now.toISOString(),
    study: {
      seconds: totals.day,
      sessions: sessions.length,
      byModule: groupByModule(
        sessions.map((s) => ({
          // The live name if the module still exists, so a rename reads through; the snapshot
          // otherwise, so a deleted module is still named rather than mistaken for free study.
          title: s.module?.title ?? s.moduleTitle,
          seconds: s.seconds ?? 0,
          stats: s.stats,
        })),
      ),
      running: runningToday
        ? {
            title: runningToday.module?.title ?? runningToday.moduleTitle,
            seconds: secondsBetween(runningToday.startedAt, now),
            stats: runningToday.stats,
          }
        : null,
      weekSeconds: totals.week,
      weekStart: totals.weekStart,
      streak: streakEndingOn(date, studied),
    },
    xp: {
      total: gains.reduce((n, g) => n + g.xp, 0),
      gains,
      totalLevelBefore: totalLevel(before),
      totalLevelAfter: totalLevel(after),
    },
    ap: apForDate(
      units.map((u) => ({
        course: u.course.shortName,
        number: u.number,
        title: u.title,
        completedAt: u.completedAt,
      })),
      date,
    ),
    vocab: {
      ...vocab,
      run: run ? { answered: runAnswered, total: run._count.questions } : null,
    },
  };
}
