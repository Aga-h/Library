/**
 * Calendar dates, kept strictly date-only.
 *
 * Everything in the calendar is a *date* — "the 19th" — not an instant. The repo's one existing
 * date-ish column (`ComicIssue.releaseDate`) is a bare `DateTime` round-tripped through
 * `toISOString().slice(0,10)`, which survives only because both ends happen to use UTC. That is
 * not a foundation to build day-of-week and range arithmetic on.
 *
 * So: dates are carried as `"YYYY-MM-DD"` strings ("keys") in application code, stored as
 * Postgres `date`, and every conversion goes through here using **UTC accessors only**.
 * Nothing outside this module may call getDay()/getDate()/getMonth().
 *
 * Keys sort lexicographically into chronological order, which is why ranges can be compared
 * with plain `<=` — the same trick `padKey` uses for months in lib/finances-utils.ts.
 */

/**
 * The deploy region is Tokyo (UTC+9) and the user is in Turkey (UTC+3). Server `new Date()` is
 * therefore the wrong day for six hours out of every twenty-four — a bug the finance quick-log
 * form already had to work around on the client. A calendar cannot hand-wave "today", so it is
 * pinned to the user's zone rather than the server's.
 */
export const APP_TIME_ZONE = "Europe/Istanbul";

/** Today in the user's timezone, as a date key. */
export function todayKey(now: Date = new Date()): DateKey {
  // en-CA formats as YYYY-MM-DD, which is exactly the key format.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now) as DateKey;
}

export type DateKey = string & { readonly __dateKey?: unique symbol };

const KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !KEY.test(value)) return false;
  // Rejects 2026-02-30: round-tripping a real date gives the same string back.
  return toKey(fromKey(value as DateKey)) === value;
}

/** `Date` (UTC midnight) → key. */
export function toKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10) as DateKey;
}

/** Key → `Date` at UTC midnight, which is what Postgres `date` round-trips as. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(key: DateKey): number {
  return fromKey(key).getUTCDay();
}

export function isWeekend(key: DateKey): boolean {
  const d = dayOfWeek(key);
  return d === 0 || d === 6;
}

/** Inclusive on both ends, as a school term is. */
export function isWithin(key: DateKey, start: DateKey, end: DateKey): boolean {
  return key >= start && key <= end;
}

/** Every date in a month, in order. */
export function datesInMonth(year: number, month: number): DateKey[] {
  const out: DateKey[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}` as DateKey);
  }
  return out;
}

/**
 * The 6×7 grid a month is drawn on, Monday-first, padded with the surrounding days so every
 * row is full. Returns 42 keys; callers use `keyMonth` to grey out the neighbours.
 */
export function monthGrid(year: number, month: number): DateKey[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01` as DateKey;
  const mondayFirst = (dayOfWeek(first) + 6) % 7; // Sunday 0 → 6, Monday 1 → 0
  const start = addDays(first, -mondayFirst);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** The month a key belongs to, for greying out grid padding. */
export function keyMonth(key: DateKey): number {
  return Number(key.slice(5, 7));
}
