// The daily review — what one day of study added up to.
//
// Pure: it takes rows the service has already fetched and assembles them, so every rule here can
// be tested without a database. lib/review-service.ts does the fetching.
//
// The one rule that runs through all of it: a *day* is a day in the app's timezone. Sessions carry
// a date already, but AP ticks and vocabulary answers are instants, and an answer at 00:30 in
// Istanbul is still 21:30 the previous day in UTC. Everything is bucketed through `todayKey`, the
// same function that decides what "today" means everywhere else.

import type { Stat } from "@prisma/client";
import { levelFromXp } from "@/lib/leveling";
import { addDays, fromKey, todayKey, type DateKey } from "@/lib/dates";

// ─── Day boundaries ──────────────────────────────────────────────────────────

/**
 * A UTC window guaranteed to contain every instant of `date` in any timezone: a coarse first
 * filter for the database, which `onLocalDate` then makes exact.
 */
export function coarseWindow(date: DateKey): { gte: Date; lt: Date } {
  return { gte: fromKey(addDays(date, -1)), lt: fromKey(addDays(date, 2)) };
}

/** The rows whose instant falls on `date` in the app's timezone. */
export function onLocalDate<T>(rows: T[], date: DateKey, at: (row: T) => Date | null): T[] {
  return rows.filter((row) => {
    const instant = at(row);
    return instant !== null && todayKey(instant) === date;
  });
}

// ─── Study time ──────────────────────────────────────────────────────────────

export interface SessionRow {
  /** The module's name, or null for free study. */
  title: string | null;
  seconds: number;
  stats: Stat[];
}

export interface ModuleTime {
  /** Null for free study. */
  title: string | null;
  seconds: number;
  sessions: number;
  /** Every stat those sessions paid. For free study, the union of what each one rolled. */
  stats: Stat[];
}

/** Time per thing studied, longest first. Free sessions collapse into one row. */
export function groupByModule(rows: SessionRow[]): ModuleTime[] {
  const named = new Map<string, ModuleTime>();
  let free: ModuleTime | null = null;

  for (const row of rows) {
    let group: ModuleTime;
    if (row.title === null) {
      free ??= { title: null, seconds: 0, sessions: 0, stats: [] };
      group = free;
    } else {
      group = named.get(row.title) ?? { title: row.title, seconds: 0, sessions: 0, stats: [] };
      named.set(row.title, group);
    }
    group.seconds += row.seconds;
    group.sessions += 1;
    for (const stat of row.stats) if (!group.stats.includes(stat)) group.stats.push(stat);
  }

  const all = [...named.values(), ...(free ? [free] : [])];
  return all.sort((a, b) => b.seconds - a.seconds);
}

export interface Streak {
  /** Consecutive days with study, ending today — or ending yesterday if nothing yet today. */
  days: number;
  /**
   * False when there is no study today. The streak is not broken yet, only unfinished: at a
   * 23:15 report that is the one thing worth saying loudly.
   */
  includesToday: boolean;
}

export function streakEndingOn(date: DateKey, studied: ReadonlySet<string>): Streak {
  const includesToday = studied.has(date);
  let cursor = includesToday ? date : addDays(date, -1);
  let days = 0;
  while (studied.has(cursor)) {
    days++;
    cursor = addDays(cursor, -1);
  }
  return { days, includesToday };
}

// ─── XP and levels ───────────────────────────────────────────────────────────

export interface StatGain {
  stat: Stat;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

/**
 * What the day added to each stat, given cumulative XP at the end of the day before and at the
 * end of this one. Only stats that moved are returned, biggest gain first.
 */
export function statGains(before: Record<string, number>, after: Record<string, number>): StatGain[] {
  const stats = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<Stat>;
  const gains: StatGain[] = [];
  for (const stat of stats) {
    const b = before[stat] ?? 0;
    const a = after[stat] ?? 0;
    if (a > b) gains.push({ stat, xp: a - b, levelBefore: levelFromXp(b), levelAfter: levelFromXp(a) });
  }
  return gains.sort((x, y) => y.xp - x.xp || x.stat.localeCompare(y.stat));
}

/** The sum of every stat's level — the headline number. */
export function totalLevel(xp: Record<string, number>): number {
  return Object.values(xp).reduce((sum, amount) => sum + levelFromXp(amount), 0);
}

// ─── AP units ────────────────────────────────────────────────────────────────

export interface ApUnitRow {
  course: string;
  number: number;
  title: string;
  completedAt: Date | null;
}

export interface ApDay {
  /** Units ticked off on this date. */
  completed: { course: string; number: number; title: string }[];
  /** Every course's standing as of the end of this date, in the order the rows came in. */
  progress: { course: string; done: number; total: number }[];
}

export function apForDate(units: ApUnitRow[], date: DateKey): ApDay {
  const completed = onLocalDate(units, date, (u) => u.completedAt)
    .map(({ course, number, title }) => ({ course, number, title }));

  const progress = new Map<string, { course: string; done: number; total: number }>();
  for (const unit of units) {
    const entry = progress.get(unit.course) ?? { course: unit.course, done: 0, total: 0 };
    entry.total += 1;
    // As of the end of that day, so a review of last Tuesday is not flattered by today's ticks.
    if (unit.completedAt && todayKey(unit.completedAt) <= date) entry.done += 1;
    progress.set(unit.course, entry);
  }

  return { completed, progress: [...progress.values()] };
}

// ─── SAT vocabulary ──────────────────────────────────────────────────────────

export type Verdict = "DONE" | "AMBIGUOUS" | "TO_REVIEW";

export interface VocabAnswerRow {
  chosenId: string | null;
  meaningId: string;
  verdict: Verdict | null;
  word: string;
  meaning: string;
}

export interface VocabDay {
  answered: number;
  correct: number;
  wrong: number;
  done: number;
  ambiguous: number;
  toReview: number;
  /** Answered correctly but not yet filed as Done or Ambiguous. */
  unfiled: number;
  /** Whole-number percentage, or null with nothing answered — never a misleading 0%. */
  accuracy: number | null;
  /** The words that went to To Review, so the report can say what to look at tomorrow. */
  toReviewWords: { word: string; meaning: string }[];
}

/** Tallies the answers already narrowed to one day. */
export function tallyVocab(rows: VocabAnswerRow[]): VocabDay {
  const answered = rows.filter((r) => r.chosenId !== null);
  const correct = answered.filter((r) => r.chosenId === r.meaningId);
  const count = (v: Verdict) => answered.filter((r) => r.verdict === v).length;

  return {
    answered: answered.length,
    correct: correct.length,
    wrong: answered.length - correct.length,
    done: count("DONE"),
    ambiguous: count("AMBIGUOUS"),
    toReview: count("TO_REVIEW"),
    unfiled: correct.filter((r) => r.verdict === null).length,
    accuracy: answered.length === 0 ? null : Math.round((correct.length / answered.length) * 100),
    toReviewWords: answered
      .filter((r) => r.verdict === "TO_REVIEW")
      .map(({ word, meaning }) => ({ word, meaning })),
  };
}

// ─── The whole review ────────────────────────────────────────────────────────

export interface DailyReview {
  date: DateKey;
  generatedAt: string;
  study: {
    /** Banked time today, plus a session still running. */
    seconds: number;
    sessions: number;
    byModule: ModuleTime[];
    /** A session still going when the review was made — not paid yet. */
    running: { title: string | null; seconds: number; stats: Stat[] } | null;
    weekSeconds: number;
    weekStart: DateKey;
    streak: Streak;
  };
  xp: {
    total: number;
    gains: StatGain[];
    totalLevelBefore: number;
    totalLevelAfter: number;
  };
  ap: ApDay;
  vocab: VocabDay & {
    /** Where the current test stands overall, not just today. */
    run: { answered: number; total: number } | null;
  };
}
