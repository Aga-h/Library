// Task rules — sessions, the completion bar and the daily verdict.
//
// A task is a module booked into a slot on the calendar. You work it by running
// sessions inside its window. Once the window closes the task is judged: work at
// least COMPLETION_RATIO of the booked hours and it is completed, otherwise it
// is a failure. Completed tasks pay XP — one XP per minute worked — to every
// stat their module trains.
//
// Everything here is pure and safe to import from client components; the
// database side lives in lib/task-service.ts.

import type { Module, ModuleColor, Stat, Task, TaskSession, TaskStatus } from "@prisma/client";
import { localToDate } from "@/lib/time";

/** Fraction of the booked time that has to be worked for a task to count. */
export const COMPLETION_RATIO = 0.5;

export type TaskWithModule = Task & { module: Module };
export type TaskWithSessions = TaskWithModule & { sessions: TaskSession[] };

export function scheduledSeconds(task: Pick<Task, "startsAt" | "endsAt">): number {
  return Math.max(0, Math.round((task.endsAt.getTime() - task.startsAt.getTime()) / 1000));
}

/** Seconds of work needed to clear the bar. */
export function requiredSeconds(task: Pick<Task, "startsAt" | "endsAt">): number {
  return Math.ceil(scheduledSeconds(task) * COMPLETION_RATIO);
}

export function openSession(sessions: TaskSession[]): TaskSession | undefined {
  return sessions.find((s) => s.endedAt === null);
}

/** Seconds a session has run for, never counting past the end of the window. */
export function sessionSeconds(
  session: TaskSession,
  task: Pick<Task, "endsAt">,
  now: Date = new Date(),
): number {
  const end = Math.min((session.endedAt ?? now).getTime(), task.endsAt.getTime());
  return Math.max(0, Math.round((end - session.startedAt.getTime()) / 1000));
}

/** Banked work plus whatever the running session has put in so far. */
export function workedSecondsNow(task: TaskWithSessions, now: Date = new Date()): number {
  const running = openSession(task.sessions);
  return task.workedSeconds + (running ? sessionSeconds(running, task, now) : 0);
}

export function isFinal(task: Pick<Task, "status">): boolean {
  return task.status === "COMPLETED" || task.status === "FAILED";
}

export function taskTitle(task: TaskWithModule): string {
  return task.title?.trim() || task.module.name;
}

// ─── Daily verdict ───────────────────────────────────────────────────────────

export type DayOutcome = "EMPTY" | "PENDING" | "LIT" | "EVEN" | "EXTINGUISHED";

export interface DayVerdict {
  outcome: DayOutcome;
  completed: number;
  failed: number;
  open: number;
  /** True once every task of the day has been judged. */
  settled: boolean;
}

/** More failures than completions and the day is extinguished. */
export function dayVerdict(tasks: { status: TaskStatus }[]): DayVerdict {
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const failed = tasks.filter((t) => t.status === "FAILED").length;
  const open = tasks.length - completed - failed;
  const settled = open === 0;

  let outcome: DayOutcome;
  if (tasks.length === 0) outcome = "EMPTY";
  else if (failed > completed) outcome = "EXTINGUISHED";
  else if (open > 0) outcome = "PENDING";
  else if (completed > failed) outcome = "LIT";
  else outcome = "EVEN";

  return { outcome, completed, failed, open, settled };
}

export const DAY_OUTCOME_LABEL: Record<DayOutcome, string> = {
  EMPTY: "Nothing booked",
  PENDING: "In progress",
  LIT: "Lit",
  EVEN: "Even",
  EXTINGUISHED: "Extinguished",
};

// ─── View models ─────────────────────────────────────────────────────────────
// Plain, serialisable shapes for the client components.

export interface TaskView {
  id: string;
  title: string;
  moduleId: string;
  moduleName: string;
  color: ModuleColor;
  stats: Stat[];
  day: string;
  startsAt: string;
  endsAt: string;
  startMinutes: number;
  endMinutes: number;
  status: TaskStatus;
  /** Work already banked, excluding a session that is still running. */
  bankedSeconds: number;
  /** ISO start of the running session, if there is one. */
  runningSince: string | null;
  scheduledSeconds: number;
  requiredSeconds: number;
  notes: string | null;
}

export interface ModuleView {
  id: string;
  name: string;
  description: string | null;
  color: ModuleColor;
  stats: Stat[];
  archived: boolean;
}

function minutesFromMidnight(day: string, at: Date): number {
  return Math.round((at.getTime() - localToDate(day, 0).getTime()) / 60000);
}

export function toTaskView(task: TaskWithSessions): TaskView {
  const running = openSession(task.sessions);
  return {
    id: task.id,
    title: taskTitle(task),
    moduleId: task.moduleId,
    moduleName: task.module.name,
    color: task.module.color,
    stats: task.module.stats,
    day: task.day,
    startsAt: task.startsAt.toISOString(),
    endsAt: task.endsAt.toISOString(),
    startMinutes: minutesFromMidnight(task.day, task.startsAt),
    endMinutes: minutesFromMidnight(task.day, task.endsAt),
    status: task.status,
    bankedSeconds: task.workedSeconds,
    runningSince: running ? running.startedAt.toISOString() : null,
    scheduledSeconds: scheduledSeconds(task),
    requiredSeconds: requiredSeconds(task),
    notes: task.notes,
  };
}

export function toModuleView(mod: Module): ModuleView {
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description,
    color: mod.color,
    stats: mod.stats,
    archived: mod.archived,
  };
}

/** Seconds worked on a task view at `nowMs`, including a live session. */
export function viewWorkedSeconds(task: TaskView, nowMs: number): number {
  if (!task.runningSince) return task.bankedSeconds;
  const cap = Math.min(nowMs, Date.parse(task.endsAt));
  const live = Math.max(0, Math.round((cap - Date.parse(task.runningSince)) / 1000));
  return task.bankedSeconds + live;
}
