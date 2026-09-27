// Weekly study goals — how far through a target in hours you are, and what finishing it takes.
//
// Pure: no database, so the arithmetic is tested directly. Goals are stored in minutes (7.5h is
// exact that way) and progress is measured in seconds, like every other study total.

import { daysLeftInWeek, type DateKey } from "@/lib/dates";

/** A week has 168 hours. A goal above that could never be met, so it is refused. */
export const MAX_WEEKLY_GOAL_HOURS = 168;

/** Hours as typed ("7.5") → whole minutes, which is what is stored. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/** Minutes → hours for an input box: 450 → 7.5, 20 → 0.33. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export interface GoalProgress {
  goalSeconds: number;
  doneSeconds: number;
  /** Never negative: past the goal there is nothing left to do. */
  remainingSeconds: number;
  /** 0–1, for drawing a bar. `doneSeconds` keeps the real overshoot. */
  fraction: number;
  met: boolean;
  /** Days left in the week, today included. */
  daysLeft: number;
  /** What each of those days needs to finish by Sunday night. Null once the goal is met. */
  perDaySeconds: number | null;
}

/**
 * Where a weekly goal stands on `today`.
 *
 * Today counts as a day left — at 09:00 on a Monday the whole week is ahead. So the per-day figure
 * is the honest one to act on: it shrinks as you study and grows as days pass unused.
 */
export function goalProgress(goalMinutes: number, doneSeconds: number, today: DateKey): GoalProgress {
  const goalSeconds = Math.max(0, goalMinutes) * 60;
  const done = Math.max(0, doneSeconds);
  const remainingSeconds = Math.max(0, goalSeconds - done);
  const met = goalSeconds > 0 && done >= goalSeconds;
  const daysLeft = daysLeftInWeek(today);

  return {
    goalSeconds,
    doneSeconds: done,
    remainingSeconds,
    fraction: goalSeconds === 0 ? 0 : Math.min(1, done / goalSeconds),
    met,
    daysLeft,
    perDaySeconds: met ? null : Math.ceil(remainingSeconds / daysLeft),
  };
}

/**
 * One line on where a goal stands, shared by the Study page and the daily review:
 *   "Done — 1h 20m over"
 *   "7h 30m to go · 1h 53m a day for the 4 days left"
 *   "20m to go — today is the last day"
 *
 * `format` turns seconds into "2h 15m"; it is passed in so this module stays free of display code.
 */
export function paceText(p: GoalProgress, format: (seconds: number) => string): string {
  if (p.met) {
    const over = p.doneSeconds - p.goalSeconds;
    return over >= 60 ? `Done — ${format(over)} over` : "Done";
  }
  if (p.daysLeft === 1) return `${format(p.remainingSeconds)} to go — today is the last day`;
  return `${format(p.remainingSeconds)} to go · ${format(p.perDaySeconds ?? 0)} a day for the ${p.daysLeft} days left`;
}
