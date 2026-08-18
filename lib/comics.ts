// Pure helpers shared by comics server pages, client components and API routes.
// Must not import "@/lib/db" — client components import from here.

export const LANGUAGE_VALUES = [
  "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
  "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
  "JAPANESE", "CHINESE", "KOREAN",
] as const;

export interface IssueProgress {
  total: number;
  read: number;
  avgRating: number | null;
}

export function summarizeIssues(
  issues: { read: boolean; rating?: number | null }[]
): IssueProgress {
  const rated = issues.filter((i) => i.rating != null);
  return {
    total: issues.length,
    read: issues.filter((i) => i.read).length,
    avgRating: rated.length
      ? Math.round((rated.reduce((s, i) => s + (i.rating as number), 0) / rated.length) * 10) / 10
      : null,
  };
}

/** Sum progress across many titles, each carrying its own issue list. */
export function rollUp(
  titles: { issues: { read: boolean; rating?: number | null }[] }[]
): IssueProgress {
  return summarizeIssues(titles.flatMap((t) => t.issues));
}

/** "#12", "#1.5", "#0" — JS number stringification already drops a trailing .0. */
export function formatIssueNumber(n: number): string {
  return `#${n}`;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}
