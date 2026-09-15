// Database side of the task engine — materialising tasks from the calendar, resolving them,
// paying XP. Server-only: it pulls in Prisma. Pure rules live in lib/tasks.ts.

import type { Task } from "@prisma/client";
import { db } from "@/lib/db";
import { fromKey, instantAt, type DateKey } from "@/lib/calendar-dates";
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

/** Banks a running session on any other task — only one can run at a time. */
export async function bankOtherSessions(exceptTaskId: string, now: Date): Promise<void> {
  const others = await db.task.findMany({
    where: { id: { not: exceptTaskId }, sessions: { some: { endedAt: null } } },
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
