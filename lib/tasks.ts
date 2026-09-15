// Task rules — sessions, the completion bar and the daily verdict.
//
// A task is one calendar module on one real date. You work it by running sessions inside the
// hours the module occupies. Once those hours pass the task is judged: work at least
// COMPLETION_RATIO of them and it is completed, otherwise it is a failure. Completed tasks pay
// XP — one per minute worked — to every stat the module trains.
//
// Everything here is pure and safe to import from client components; the database side lives in
// lib/task-service.ts.

import type { EventModule, Stat, Task, TaskSession, TaskStatus } from "@prisma/client";

/** Fraction of the module's hours that has to be worked for a task to count. */
export const COMPLETION_RATIO = 0.5;

export type TaskWithModule = Task & { module: EventModule };
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

/**
 * A module only becomes a task if it has an end time (otherwise there are no hours to take half
 * of) and at least one stat (otherwise finishing it would pay nothing).
 */
export function isTrackable(mod: Pick<EventModule, "endMinute" | "stats">): boolean {
  return mod.endMinute != null && mod.endMinute > 0 && mod.stats.length > 0;
}

export function untrackableReason(
  mod: Pick<EventModule, "endMinute" | "stats">,
): "no-end-time" | "no-stats" | null {
  if (mod.endMinute == null) return "no-end-time";
  if (mod.stats.length === 0) return "no-stats";
  return null;
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

  let outcome: DayOutcome;
  if (tasks.length === 0) outcome = "EMPTY";
  else if (failed > completed) outcome = "EXTINGUISHED";
  else if (open > 0) outcome = "PENDING";
  else if (completed > failed) outcome = "LIT";
  else outcome = "EVEN";

  return { outcome, completed, failed, open, settled: open === 0 };
}

export const DAY_OUTCOME_LABEL: Record<DayOutcome, string> = {
  EMPTY: "Nothing to do",
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
  stats: Stat[];
  date: string;
  startsAt: string;
  endsAt: string;
  startMinute: number;
  endMinute: number;
  status: TaskStatus;
  /** Work already banked, excluding a session that is still running. */
  bankedSeconds: number;
  /** ISO start of the running session, if there is one. */
  runningSince: string | null;
  scheduledSeconds: number;
  requiredSeconds: number;
  notes: string | null;
}

export function toTaskView(task: TaskWithSessions, dateKey: string): TaskView {
  const running = openSession(task.sessions);
  return {
    id: task.id,
    title: task.module.title,
    moduleId: task.moduleId,
    stats: task.module.stats,
    date: dateKey,
    startsAt: task.startsAt.toISOString(),
    endsAt: task.endsAt.toISOString(),
    startMinute: task.module.startMinute,
    endMinute: task.module.endMinute ?? 0,
    status: task.status,
    bankedSeconds: task.workedSeconds,
    runningSince: running ? running.startedAt.toISOString() : null,
    scheduledSeconds: scheduledSeconds(task),
    requiredSeconds: requiredSeconds(task),
    notes: task.module.notes,
  };
}

/** Seconds worked on a task view at `nowMs`, including a live session. */
export function viewWorkedSeconds(task: TaskView, nowMs: number): number {
  if (!task.runningSince) return task.bankedSeconds;
  const cap = Math.min(nowMs, Date.parse(task.endsAt));
  const live = Math.max(0, Math.round((cap - Date.parse(task.runningSince)) / 1000));
  return task.bankedSeconds + live;
}

// ─── Duration formatting ─────────────────────────────────────────────────────

/** "2h 30m" / "45m" / "20s" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** "01:23:45" — for the live session timer. */
export function formatStopwatch(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
