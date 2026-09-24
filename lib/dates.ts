/**
 * Application dates, kept strictly date-only.
 *
 * A study session belongs to a *date* — "the 19th" — not an instant. The repo's one other
 * date-ish column (`ComicIssue.releaseDate`) is a bare `DateTime` round-tripped through
 * `toISOString().slice(0,10)`, which survives only because both ends happen to use UTC. That is
 * not a foundation to build day/week/month totals on.
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
 * form already had to work around on the client. "Which day did I study this" cannot be
 * hand-waved, so it is pinned to the user's zone rather than the server's.
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
