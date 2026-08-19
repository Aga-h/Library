// Status is computed from progress counts, never entered by hand — a show sitting at 24/24
// episodes should not be able to stay marked "Watching".
//
// Pure and dependency-free so both the API routes and the forms can use it, and so it can be
// tested without a database or a browser.

/** The three statuses every media type has, under whatever names it uses for them. */
export interface StatusVocabulary<T extends string = string> {
  planned: T;
  inProgress: T;
  completed: T;
}

export interface Progress {
  progress: number;
  /** null/undefined means unknown or still releasing — which can never be "completed". */
  total?: number | null;
}

export const BOOK_STATUS = {
  planned: "WANT_TO_READ",
  inProgress: "READING",
  completed: "READ",
} as const;

export const WATCH_STATUS = {
  planned: "PLAN_TO_WATCH",
  inProgress: "WATCHING",
  completed: "COMPLETED",
} as const;

export const READ_STATUS = {
  planned: "PLAN_TO_READ",
  inProgress: "READING",
  completed: "COMPLETED",
} as const;

export function deriveStatus<T extends string>(
  { progress, total }: Progress,
  vocab: StatusVocabulary<T>
): T {
  const done = Number.isFinite(progress) && progress > 0 ? progress : 0;

  // An unknown or zero total gives nothing to complete against, so the best we can say is
  // whether anything has been consumed yet. This is what keeps an ongoing series out of
  // "completed" however many chapters are read.
  const hasTotal = total != null && Number.isFinite(total) && total > 0;

  if (hasTotal && done >= (total as number)) return vocab.completed;
  if (done > 0) return vocab.inProgress;
  return vocab.planned;
}

// ─── Per-entity progress selection ───────────────────────────────────────────

export function bookProgress(b: { pagesRead?: number | null; pages?: number | null }): Progress {
  return { progress: b.pagesRead ?? 0, total: b.pages };
}

export function animeProgress(a: {
  episodesWatched?: number | null;
  episodes?: number | null;
}): Progress {
  return { progress: a.episodesWatched ?? 0, total: a.episodes };
}

export function tvProgress(t: {
  episodesWatched?: number | null;
  totalEpisodes?: number | null;
}): Progress {
  return { progress: t.episodesWatched ?? 0, total: t.totalEpisodes };
}

/**
 * Manga tracks volumes and chapters independently. Chapters lead — they are what the cards and
 * stats show, and what reading time is computed from — with volumes as the fallback for series
 * tracked only by volume. `ongoing` forces the unknown-total branch whatever the totals say.
 */
export function mangaProgress(m: {
  chaptersRead?: number | null;
  totalChapters?: number | null;
  volumesRead?: number | null;
  totalVolumes?: number | null;
  ongoing?: boolean | null;
}): Progress {
  const chaptersRead = m.chaptersRead ?? 0;
  const volumesRead = m.volumesRead ?? 0;

  if (m.ongoing) {
    return { progress: chaptersRead || volumesRead, total: null };
  }
  if (m.totalChapters != null && m.totalChapters > 0) {
    return { progress: chaptersRead, total: m.totalChapters };
  }
  if (m.totalVolumes != null && m.totalVolumes > 0) {
    return { progress: volumesRead, total: m.totalVolumes };
  }
  return { progress: chaptersRead || volumesRead, total: null };
}
