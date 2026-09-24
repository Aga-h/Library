// Database side of studying — modules, sessions and the XP they pay.
// Server-only: it pulls in Prisma. Pure rules live in lib/study.ts.

import type { Stat } from "@prisma/client";
import { db } from "@/lib/db";
import { STATS } from "@/lib/stats";
import { addDays, dayOfWeek, fromKey, toKey, type DateKey } from "@/lib/dates";
import {
  FREE_STUDY_STATS,
  secondsBetween,
  xpForSeconds,
  type RunningSessionView,
  type SessionView,
} from "@/lib/study";

// ─── Modules ─────────────────────────────────────────────────────────────────

export function listModules() {
  return db.module.findMany({ orderBy: { title: "asc" } });
}

// ─── The running session ─────────────────────────────────────────────────────

/** The session currently running, if any. Only ever one. */
export function openSession() {
  return db.studySession.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: "desc" },
    include: { module: true },
  });
}

export type StartResult =
  | { ok: true; session: { id: string } }
  | { ok: false; reason: "unknown-module" | "module-has-no-stats" };

/** Distinct stats, drawn at random. */
export function rollStats(count = FREE_STUDY_STATS): Stat[] {
  const pool = [...STATS];
  const picked: Stat[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return picked;
}

/**
 * Starts a session. With a module it pays that module's stats; without one it rolls three at
 * random, for one-off work not worth naming.
 *
 * The stats are copied onto the session rather than read back through the module later, so
 * re-pointing a module's stats never rewrites what past sessions earned.
 *
 * Starting while something is already running returns the running session untouched — one
 * thing at a time, and the alternative silently discards the time already on the clock.
 */
export async function startSession(
  date: DateKey,
  moduleId: string | null,
  now: Date = new Date(),
): Promise<StartResult> {
  const already = await openSession();
  if (already) return { ok: true, session: already };

  let stats: Stat[];
  let title: string | null = null;
  if (moduleId) {
    const mod = await db.module.findUnique({ where: { id: moduleId } });
    if (!mod) return { ok: false, reason: "unknown-module" };
    if (mod.stats.length === 0) return { ok: false, reason: "module-has-no-stats" };
    stats = mod.stats;
    title = mod.title;
  } else {
    stats = rollStats();
  }

  const session = await db.studySession.create({
    data: { date: fromKey(date), moduleId, moduleTitle: title, stats, startedAt: now },
  });
  return { ok: true, session };
}

/**
 * Ends the running session and pays its stats, one XP per minute. A session shorter than a
 * minute pays nothing rather than rounding up.
 */
export async function stopSession(now: Date = new Date()) {
  const session = await openSession();
  if (!session) return null;

  const seconds = secondsBetween(session.startedAt, now);
  const updated = await db.studySession.update({
    where: { id: session.id },
    data: { endedAt: now, seconds },
  });

  const amount = xpForSeconds(seconds);
  if (amount > 0 && session.stats.length > 0) {
    // skipDuplicates plus the unique index on (studySessionId, stat) is what stops a double
    // stop from paying twice.
    await db.xpAward.createMany({
      data: session.stats.map((stat) => ({ studySessionId: session.id, stat, amount })),
      skipDuplicates: true,
    });
  }
  return updated;
}

// ─── XP and levels ───────────────────────────────────────────────────────────

export async function statXpTotals(): Promise<Record<string, number>> {
  const rows = await db.xpAward.groupBy({ by: ["stat"], _sum: { amount: true } });
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.stat] = row._sum.amount ?? 0;
  return totals;
}

// ─── Study time ──────────────────────────────────────────────────────────────

export interface StudyTotals {
  /** Seconds studied, by window. */
  day: number;
  week: number;
  month: number;
  total: number;
  /** Monday of the current week, and the first of the month — for labelling. */
  weekStart: DateKey;
  monthStart: DateKey;
}

/**
 * Time actually studied, today / this week / this month / ever.
 *
 * `seconds` is only filled in when a session ends, so a session running right now is added on
 * top by hand. Weeks start Monday.
 */
export async function studyTotals(today: DateKey, now: Date = new Date()): Promise<StudyTotals> {
  const weekStart = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01` as DateKey;

  const banked = async (where: object) =>
    (await db.studySession.aggregate({ _sum: { seconds: true }, where }))._sum.seconds ?? 0;

  const [day, week, month, total, running] = await Promise.all([
    banked({ date: fromKey(today) }),
    banked({ date: { gte: fromKey(weekStart), lte: fromKey(today) } }),
    banked({ date: { gte: fromKey(monthStart), lte: fromKey(today) } }),
    banked({}),
    openSession(),
  ]);

  const totals: StudyTotals = { day, week, month, total, weekStart, monthStart };

  if (running) {
    const seconds = secondsBetween(running.startedAt, now);
    const key = toKey(running.date);
    totals.total += seconds;
    if (key >= monthStart && key <= today) totals.month += seconds;
    if (key >= weekStart && key <= today) totals.week += seconds;
    if (key === today) totals.day += seconds;
  }

  return totals;
}

// ─── History ─────────────────────────────────────────────────────────────────

/** Finished sessions, newest first. */
export async function recentSessions(limit = 30): Promise<SessionView[]> {
  return toViews(
    await db.studySession.findMany({
      where: { endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { module: true },
    }),
  );
}

/** Finished sessions on one date, newest first. */
export async function sessionsForDate(date: DateKey): Promise<SessionView[]> {
  return toViews(
    await db.studySession.findMany({
      where: { date: fromKey(date), endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      include: { module: true },
    }),
  );
}

type SessionRow = { id: string; date: Date; seconds: number | null; stats: Stat[];
  moduleTitle: string | null; module: { title: string } | null };

function toViews(rows: SessionRow[]): SessionView[] {
  return rows.map((row) => ({
    id: row.id,
    date: toKey(row.date),
    seconds: row.seconds ?? 0,
    stats: row.stats,
    // The live name when the module still exists, so a rename shows up in history too; the
    // snapshot only has to cover a module that has been deleted.
    moduleTitle: row.module?.title ?? row.moduleTitle,
    xp: xpForSeconds(row.seconds ?? 0),
  }));
}

export function toRunningView(
  session: NonNullable<Awaited<ReturnType<typeof openSession>>>,
): RunningSessionView {
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    stats: session.stats,
    moduleTitle: session.module?.title ?? session.moduleTitle,
  };
}
