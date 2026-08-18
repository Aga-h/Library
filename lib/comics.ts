// Pure helpers shared by comics server pages, client components and API routes.
// Must not import "@/lib/db" — client components import from here.

export const LANGUAGE_VALUES = [
  "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
  "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
  "JAPANESE", "CHINESE", "KOREAN",
] as const;

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
