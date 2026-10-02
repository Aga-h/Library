// Landing TMDB films in the library. Server-only.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { planImport, type ReportLine } from "@/lib/tmdb";
import { TmdbError, filmDetails } from "@/lib/tmdb-service";

export type ImportStatus = "WANT_TO_WATCH" | "WATCHED";

export interface ImportResult {
  universeId: string | null;
  report: ReportLine[];
  /** Films TMDB could not give details for; nothing was written for them. */
  failed: { tmdbId: number; reason: string }[];
}

/**
 * Brings films into the library — into `universeId`, or standalone when it is null. New films
 * get `status`; films already there keep theirs, and only have blanks filled: see planImport.
 */
export async function importFilms(
  universeId: string | null,
  tmdbIds: number[],
  status: ImportStatus,
): Promise<ImportResult> {
  if (universeId) {
    const universe = await db.movieUniverse.findUnique({ where: { id: universeId }, select: { id: true } });
    if (!universe) throw new TmdbError("Universe not found.", 404);
  }

  const ids = [...new Set(tmdbIds)];
  const { details, failed } = await filmDetails(ids);

  // Films added by hand are all candidates for a title match; the library is small enough that
  // reading them is cheaper than a case-insensitive title query per film.
  const rows = await db.movie.findMany({
    where: { OR: [{ tmdbId: { in: ids } }, { tmdbId: null }] },
    select: {
      id: true, title: true, year: true, tmdbId: true, imdbId: true, director: true, studio: true,
      runtime: true, coverImage: true, universeId: true, universe: { select: { name: true } },
    },
  });
  const plan = planImport(
    rows.map(({ universe, ...m }) => ({ ...m, universeName: universe?.name ?? null })),
    details,
    universeId,
  );

  // A universe page lists films by year, then by when they were added. One insert stamps every
  // row with the same moment, so each is a millisecond apart, in the order asked for — release
  // order, from a preview — and films from the same year stay in the order they came out.
  const now = Date.now();
  try {
    await db.$transaction([
      db.movie.createMany({
        data: plan.create.map((film, i) => ({ ...film, status, universeId, createdAt: new Date(now + i) })),
        // A concurrent import of the same film (a double tap) already added it: keep one.
        skipDuplicates: true,
      }),
      ...plan.update.map(({ id, data }) => db.movie.update({ where: { id }, data })),
    ]);
  } catch (e) {
    // Linking a hand-added film to an id another import has just taken.
    if (isUniqueViolation(e)) throw new TmdbError("Another import ran at the same time — try again.", 409);
    throw e;
  }

  const added = plan.report.filter((line) => line.outcome === "added").map((line) => line.tmdbId);
  if (added.length > 0) {
    const created = await db.movie.findMany({ where: { tmdbId: { in: added } }, select: { id: true, tmdbId: true } });
    const idFor = new Map(created.map((m) => [m.tmdbId, m.id]));
    for (const line of plan.report) {
      if (line.outcome === "added") line.movieId = idFor.get(line.tmdbId);
    }
  }

  return { universeId, report: plan.report, failed };
}

/** Which of these TMDB films are in the library already, and where. For the import preview. */
export async function libraryPlaces(
  tmdbIds: number[],
): Promise<Map<number, { movieId: string; universeId: string | null; universeName: string | null }>> {
  if (tmdbIds.length === 0) return new Map();
  const rows = await db.movie.findMany({
    where: { tmdbId: { in: tmdbIds } },
    select: { id: true, tmdbId: true, universeId: true, universe: { select: { name: true } } },
  });
  return new Map(
    rows.map((m) => [m.tmdbId!, { movieId: m.id, universeId: m.universeId, universeName: m.universe?.name ?? null }]),
  );
}
