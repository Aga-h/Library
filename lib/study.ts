// Study rules — sessions, modules and the XP they pay.
//
// You study by starting a session. Pick a module to say what you are studying and the session
// pays the stats that module trains; start one without a module and it rolls three stats at
// random, for one-off work not worth naming. Either way XP is one per minute actually studied.
//
// Everything here is pure and safe to import from client components; the database side lives in
// lib/study-service.ts.

import type { Stat } from "@prisma/client";

/** XP per minute studied. */
export const XP_PER_MINUTE = 1;

/** A session shorter than this pays nothing, rather than rounding up to one minute. */
export const MIN_XP_MINUTES = 1;

/** How many stats a session without a module rolls. */
export const FREE_STUDY_STATS = 3;

/** XP a session of this length pays to each of its stats. */
export function xpForSeconds(seconds: number): number {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= MIN_XP_MINUTES ? minutes * XP_PER_MINUTE : 0;
}

/** Seconds between two instants, floored at zero — never negative from a clock skew. */
export function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

// ─── View models ─────────────────────────────────────────────────────────────
// Plain, serialisable shapes for the client components.

export interface ModuleView {
  id: string;
  title: string;
  notes: string | null;
  stats: Stat[];
}

export interface RunningSessionView {
  id: string;
  /** ISO instant the session started, so the client can run the stopwatch itself. */
  startedAt: string;
  stats: Stat[];
  /** What is being studied, or null for a free session. */
  moduleTitle: string | null;
}

export interface SessionView {
  id: string;
  date: string;
  seconds: number;
  stats: Stat[];
  /**
   * What was studied — the module's current name, or the name it had at the time if the module
   * has since been deleted. Null only for a session that never had one.
   */
  moduleTitle: string | null;
  xp: number;
}

/** Seconds a running session has been going at `nowMs`. */
export function runningSeconds(session: RunningSessionView, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - Date.parse(session.startedAt)) / 1000));
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
