// Database side of the task engine — resolution, XP awards and queries.
// Server-only: it pulls in Prisma. Pure rules live in lib/tasks.ts.

import type { Module, Task } from "@prisma/client";
import { db } from "@/lib/db";
import {
  openSession,
  requiredSeconds,
  sessionSeconds,
  type TaskWithSessions,
} from "@/lib/tasks";

/**
 * Closes any session that outlived its window and judges every task whose
 * window has passed. Safe to call on every read — it does nothing when there is
 * nothing to settle.
 *
 * Returns the instant it settled against, so a server component can pass "now"
 * to the client without reading the clock during render.
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
 * Judges a single task there and then — used by the "finish early" button, and
 * by syncTasks once a window has closed.
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

  if (completed) await awardXp(task.id, task.module.stats, worked);
  return updated;
}

/** One XP per minute worked, to every stat the module trains. */
async function awardXp(taskId: string, stats: Module["stats"], workedSeconds: number): Promise<void> {
  if (stats.length === 0) return;
  const amount = Math.max(1, Math.round(workedSeconds / 60));
  await db.xpAward.createMany({
    data: stats.map((stat) => ({ taskId, stat, amount })),
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

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function statXpTotals(): Promise<Record<string, number>> {
  const rows = await db.xpAward.groupBy({ by: ["stat"], _sum: { amount: true } });
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.stat] = row._sum.amount ?? 0;
  return totals;
}

export async function tasksForDays(days: string[]): Promise<TaskWithSessions[]> {
  return db.task.findMany({
    where: { day: { in: days } },
    include: { module: true, sessions: true },
    orderBy: { startsAt: "asc" },
  });
}

export async function tasksForDay(day: string): Promise<TaskWithSessions[]> {
  return tasksForDays([day]);
}

export async function tasksBetween(from: string, to: string): Promise<TaskWithSessions[]> {
  return db.task.findMany({
    where: { day: { gte: from, lte: to } },
    include: { module: true, sessions: true },
    orderBy: { startsAt: "asc" },
  });
}
