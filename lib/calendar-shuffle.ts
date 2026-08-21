/**
 * Dealing day plans onto dates.
 *
 * Pure: no database, no clock, no global randomness. The RNG is injected so the behaviour can
 * be asserted exactly, the same way lib/derive-status.ts is a pure rule with a real test script
 * rather than logic buried in a route handler.
 */

import type { DateKey } from "@/lib/calendar-dates";

export type DayKind = "SCHOOL" | "HOLIDAY";

/** () => number in [0, 1), i.e. Math.random. */
export type Rng = () => number;

export interface DealInput {
  /** Target dates, in chronological order. */
  dates: DateKey[];
  /** What kind each date is. Derived from terms and weekends by the caller. */
  kindOf: (date: DateKey) => DayKind;
  /** Available plan ids per kind. Either list may be empty. */
  plansByKind: Record<DayKind, string[]>;
  /** Dates that already have a plan. In "fill" mode these are left completely alone. */
  existing: ReadonlySet<DateKey>;
  mode: "fill" | "redeal";
  rng: Rng;
}

export interface DealResult {
  /** date → plan id, for the dates this deal actually assigns. */
  assignments: Map<DateKey, string>;
  /** Dates skipped because their kind has no plans at all. */
  skipped: { date: DateKey; kind: DayKind }[];
}

/** Fisher–Yates. Returns a new array; does not touch the input. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deals plans across dates, one deck per kind.
 *
 * A deck holds every plan of its kind in random order. Dates are served from the deck in
 * chronological order, and the deck is refilled with a fresh shuffle only once it is empty —
 * which is what makes every plan get used before any plan repeats. With 4 plans over 30 dates
 * each plan appears 7 or 8 times rather than clumping.
 *
 * Degenerate cases are ordinary, not errors: one plan means every date gets it, and no plans of
 * a kind means those dates are reported in `skipped` and left empty for the caller to explain.
 */
export function dealPlans({
  dates, kindOf, plansByKind, existing, mode, rng,
}: DealInput): DealResult {
  const assignments = new Map<DateKey, string>();
  const skipped: { date: DateKey; kind: DayKind }[] = [];
  const decks: Record<string, string[]> = { SCHOOL: [], HOLIDAY: [] };

  for (const date of dates) {
    // "fill" never touches a date that already has a plan — including one set by hand.
    if (mode === "fill" && existing.has(date)) continue;

    const kind = kindOf(date);
    const pool = plansByKind[kind];
    if (!pool || pool.length === 0) {
      skipped.push({ date, kind });
      continue;
    }

    if (decks[kind].length === 0) decks[kind] = shuffled(pool, rng);
    assignments.set(date, decks[kind].pop()!);
  }

  return { assignments, skipped };
}

/**
 * The kind of a date, derived rather than stored: terms get edited, and a stored kind would
 * quietly disagree with the calendar afterwards.
 *
 * A weekend is always a holiday, whatever the terms say — that rule wins over everything.
 */
export function deriveKind(
  date: DateKey,
  opts: {
    isWeekend: (d: DateKey) => boolean;
    terms: { startDate: DateKey; endDate: DateKey }[];
    daysOff: ReadonlySet<DateKey>;
  }
): DayKind {
  if (opts.isWeekend(date)) return "HOLIDAY";
  if (opts.daysOff.has(date)) return "HOLIDAY";
  const inTerm = opts.terms.some((t) => date >= t.startDate && date <= t.endDate);
  return inTerm ? "SCHOOL" : "HOLIDAY";
}
