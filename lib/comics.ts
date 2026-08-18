// Pure helpers shared by comics server pages, client components and API routes.
// Must not import "@/lib/db" — client components import from here.

/** The shape every rollup needs from an issue. `timesReread` is required, not optional,
 *  so a page that forgets to select it fails to compile instead of silently under-reporting
 *  reading time. */
export interface IssueLike {
  read: boolean;
  timesReread: number;
  rating?: number | null;
}

export interface IssueProgress {
  total: number;
  read: number;
  /** Sum of (timesReread + 1) over read issues — one unit per full pass through an issue.
   *  This, not `read`, is what reading time is computed from. */
  readUnits: number;
  /** Total rereads across all read issues, for display. */
  rereads: number;
  avgRating: number | null;
}

export function summarizeIssues(issues: IssueLike[]): IssueProgress {
  const rated = issues.filter((i) => i.rating != null);
  const readIssues = issues.filter((i) => i.read);
  return {
    total: issues.length,
    read: readIssues.length,
    readUnits: readIssues.reduce((s, i) => s + i.timesReread + 1, 0),
    rereads: readIssues.reduce((s, i) => s + i.timesReread, 0),
    avgRating: rated.length
      ? Math.round((rated.reduce((s, i) => s + (i.rating as number), 0) / rated.length) * 10) / 10
      : null,
  };
}

/** Sum progress across many titles, each carrying its own issue list. */
export function rollUp(titles: { issues: IssueLike[] }[]): IssueProgress {
  return summarizeIssues(titles.flatMap((t) => t.issues));
}

/** "#12", "#1.5", "#0" — JS number stringification already drops a trailing .0. */
export function formatIssueNumber(n: number): string {
  return `#${n}`;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/**
 * Per-title issue aggregates, computed in the database.
 *
 * The publisher and universe pages previously nested `issues: { select: … }` with no `where`
 * and no `take`, so every issue row in the library crossed the wire to produce a handful of
 * counters. This is bounded by title count instead.
 */
export interface TitleAgg {
  total: number;
  read: number;
  readUnits: number;
  rereads: number;
}

export function foldAggs(aggs: Iterable<TitleAgg>): IssueProgress {
  let total = 0, read = 0, readUnits = 0, rereads = 0;
  for (const a of aggs) {
    total += a.total; read += a.read; readUnits += a.readUnits; rereads += a.rereads;
  }
  return { total, read, readUnits, rereads, avgRating: null };
}

export const EMPTY_AGG: TitleAgg = { total: 0, read: 0, readUnits: 0, rereads: 0 };
