// Database side of the task engine — materialising tasks from the calendar, resolving them,
// paying XP. Server-only: it pulls in Prisma. Pure rules live in lib/tasks.ts.

import type { Stat, Task } from "@prisma/client";
import { db } from "@/lib/db";
import { STATS } from "@/lib/stats";
import { addDays, dayOfWeek, fromKey, instantAt, toKey, type DateKey } from "@/lib/calendar-dates";
import {
  isTrackable,
  openSession,
  requiredSeconds,
  sessionSeconds,
  type TaskWithSessions,
} from "@/lib/tasks";

/**
 * Makes sure every trackable module in this date's day plan has a task row, and returns the
 * date's tasks.
 *
 * Tasks are never created by hand — the calendar already says what a day holds, so this derives
 * them from it. Called on every read of a date, so it has to be cheap and idempotent: the
 * unique index on (moduleId, date) makes the insert a no-op the second time.
 *
 * A module whose hours changed after its task was created keeps the old window. Re-dealing the
 * day is what re-plans it; silently moving a window someone has already worked against would
 * throw away their session time.
 */
export async function tasksForDate(date: DateKey): Promise<TaskWithSessions[]> {
  const at = fromKey(date);

  const entry = await db.calendarDay.findUnique({
    where: { date: at },
    include: { plan: { include: { modules: { include: { module: true } } } } },
  });

  const wanted = (entry?.plan?.modules ?? [])
    .map((placement) => placement.module)
    .filter(isTrackable);

  if (wanted.length > 0) {
    await db.task.createMany({
      data: wanted.map((mod) => ({
        moduleId: mod.id,
        date: at,
        startsAt: instantAt(date, mod.startMinute),
        endsAt: instantAt(date, mod.endMinute!),
      })),
      skipDuplicates: true,
    });
  }

  return db.task.findMany({
    where: { date: at },
    include: { module: true, sessions: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Closes any session that outlived its window and judges every task whose window has passed.
 * Safe to call on every read — it does nothing when there is nothing to settle.
 *
 * Returns the instant it settled against, so a server component can pass "now" to the client
 * without reading the clock during render.
 */
export async function syncTasks(now: Date = new Date()): Promise<Date> {
  const due = await db.task.findMany({
    where: { status: { in: ["SCHEDULED", "ACTIVE"] }, endsAt: { lte: now } },
    include: { module: true, sessions: { where: { endedAt: null } } },
  });
  for (const task of due) await settle(task, task.endsAt);
  return now;
}

/**
 * Judges a single task there and then — used by the "finish early" button, and by syncTasks once
 * a window has closed.
 */
export async function settle(task: TaskWithSessions, at: Date): Promise<Task> {
  const cutoff = new Date(Math.min(at.getTime(), task.endsAt.getTime()));

  let worked = task.workedSeconds;
  for (const session of task.sessions) {
    if (session.endedAt) continue;
    const seconds = sessionSeconds(session, task, cutoff);
    worked += seconds;
    await db.taskSession.update({
      where: { id: session.id },
      data: { endedAt: cutoff, seconds },
    });
  }

  const required = requiredSeconds(task);
  const completed = required > 0 && worked >= required;

  const updated = await db.task.update({
    where: { id: task.id },
    data: {
      status: completed ? "COMPLETED" : "FAILED",
      workedSeconds: worked,
      resolvedAt: cutoff,
    },
  });

  if (completed) await awardXp(task, worked);
  return updated;
}

/** One XP per minute worked, to every stat the module trains. */
async function awardXp(task: TaskWithSessions, workedSeconds: number): Promise<void> {
  const stats = task.module.stats;
  if (stats.length === 0) return;
  const amount = Math.max(1, Math.round(workedSeconds / 60));
  // The unique index on (taskId, stat) is what actually guarantees a task pays only once.
  await db.xpAward.createMany({
    data: stats.map((stat) => ({ taskId: task.id, stat, amount })),
    skipDuplicates: true,
  });
}

/**
 * Banks a running session on any other task — only one thing can run at a time. Pass null to
 * bank every open task session, with nothing exempt.
 */
export async function bankOtherSessions(exceptTaskId: string | null, now: Date): Promise<void> {
  const others = await db.task.findMany({
    where: {
      ...(exceptTaskId ? { id: { not: exceptTaskId } } : {}),
      sessions: { some: { endedAt: null } },
    },
    include: { sessions: { where: { endedAt: null } } },
  });
  for (const other of others) {
    for (const session of other.sessions) {
      const seconds = sessionSeconds(session, other, now);
      await db.taskSession.update({ where: { id: session.id }, data: { endedAt: now, seconds } });
      await db.task.update({
        where: { id: other.id },
        data: { workedSeconds: { increment: seconds }, status: "SCHEDULED" },
      });
    }
  }
}

/** Ends the running session on a task, banking the time worked. */
export async function stopSession(task: TaskWithSessions, now: Date): Promise<void> {
  const running = openSession(task.sessions);
  if (!running) return;
  const seconds = sessionSeconds(running, task, now);
  await db.taskSession.update({ where: { id: running.id }, data: { endedAt: now, seconds } });
  await db.task.update({
    where: { id: task.id },
    data: { workedSeconds: { increment: seconds }, status: "SCHEDULED" },
  });
}

export async function statXpTotals(): Promise<Record<string, number>> {
  const rows = await db.xpAward.groupBy({ by: ["stat"], _sum: { amount: true } });
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.stat] = row._sum.amount ?? 0;
  return totals;
}

// ─── Study time ──────────────────────────────────────────────────────────────

export interface StudyTotals {
  /** Seconds worked, by window. */
  day: number;
  week: number;
  month: number;
  total: number;
  /** Monday of the current week, and the first of the month — for labelling. */
  weekStart: DateKey;
  monthStart: DateKey;
}

/**
 * Time actually worked, today / this week / this month / ever.
 *
 * Counts every session, not just the ones that cleared the completion bar — an hour spent on a
 * task you then failed is still an hour studied. `workedSeconds` only holds *banked* time, so a
 * session running right now is added on top.
 *
 * Weeks start Monday, matching the calendar's month grid.
 */
export async function studyTotals(today: DateKey, now: Date = new Date()): Promise<StudyTotals> {
  const weekStart = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01` as DateKey;

  const banked = async (where: object) =>
    (await db.task.aggregate({ _sum: { workedSeconds: true }, where }))._sum.workedSeconds ?? 0;

  const free = async (where: object) =>
    (await db.studySession.aggregate({ _sum: { seconds: true }, where }))._sum.seconds ?? 0;

  const [day, week, month, total, freeDay, freeWeek, freeMonth, freeTotal, running, study] =
    await Promise.all([
      banked({ date: fromKey(today) }),
      banked({ date: { gte: fromKey(weekStart), lte: fromKey(today) } }),
      banked({ date: { gte: fromKey(monthStart), lte: fromKey(today) } }),
      banked({}),
      free({ date: fromKey(today) }),
      free({ date: { gte: fromKey(weekStart), lte: fromKey(today) } }),
      free({ date: { gte: fromKey(monthStart), lte: fromKey(today) } }),
      free({}),
      db.task.findFirst({
        where: { sessions: { some: { endedAt: null } } },
        include: { module: true, sessions: { where: { endedAt: null } } },
      }),
      openStudySession(),
    ]);

  const totals: StudyTotals = {
    day: day + freeDay,
    week: week + freeWeek,
    month: month + freeMonth,
    total: total + freeTotal,
    weekStart,
    monthStart,
  };

  /** A session still running has banked nothing yet, so add its elapsed time by hand. */
  const addLive = (seconds: number, key: DateKey) => {
    totals.total += seconds;
    if (key >= monthStart && key <= today) totals.month += seconds;
    if (key >= weekStart && key <= today) totals.week += seconds;
    if (key === today) totals.day += seconds;
  };

  if (running) {
    const open = running.sessions[0];
    if (open) addLive(sessionSeconds(open, running, now), toKey(running.date));
  }
  if (study) {
    addLive(Math.max(0, Math.round((now.getTime() - study.startedAt.getTime()) / 1000)), toKey(study.date));
  }

  return totals;
}

// ─── Free study ──────────────────────────────────────────────────────────────

/** Minutes of study that earn no XP — below this, a session rounds to nothing. */
const MIN_XP_MINUTES = 1;

export type StudySessionWithStats = Awaited<ReturnType<typeof openStudySession>>;

/** The study session currently running, if any. */
export async function openStudySession() {
  return db.studySession.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } });
}

/** Three distinct stats, drawn at random. */
export function rollStats(count = 3): Stat[] {
  const pool = [...STATS];
  const picked: Stat[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return picked;
}

/**
 * Starts a free study session. Any task session running is banked first — only one thing can be
 * running at a time, whether it is scheduled or not.
 */
export async function startStudySession(date: DateKey, now: Date = new Date()) {
  const already = await openStudySession();
  if (already) return already;

  await bankOtherSessions(null, now);
  return db.studySession.create({
    data: { date: fromKey(date), stats: rollStats(), startedAt: now },
  });
}

/**
 * Ends the running study session and pays its stats, one XP per minute. A session shorter than a
 * minute pays nothing rather than rounding up to one.
 */
export async function stopStudySession(now: Date = new Date()) {
  const session = await openStudySession();
  if (!session) return null;

  const seconds = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));
  const updated = await db.studySession.update({
    where: { id: session.id },
    data: { endedAt: now, seconds },
  });

  const amount = Math.floor(seconds / 60);
  if (amount >= MIN_XP_MINUTES && session.stats.length > 0) {
    await db.xpAward.createMany({
      data: session.stats.map((stat) => ({ studySessionId: session.id, stat, amount })),
      skipDuplicates: true,
    });
  }
  return updated;
}
