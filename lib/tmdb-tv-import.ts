// Landing TMDB shows in the library: a series per show, a row per season. Server-only.

import { db } from "@/lib/db";
import { todayKey } from "@/lib/dates";
import { isUniqueViolation } from "@/lib/prisma-errors";
import type { Outcome } from "@/lib/tmdb";
import { placeSeries, planSeasons, type ExistingSeries, type TmdbShowDetails } from "@/lib/tmdb-tv";
import { TmdbError, showDetails } from "@/lib/tmdb-service";

/** Advisory-lock namespace for show imports, so they never wait on some unrelated lock. */
const LOCK_NAMESPACE = 7_302_431;

export interface ShowReportLine {
  tmdbId: number;
  /** The series' name in the library — yours, when it was linked to one you made. */
  name: string;
  outcome: Outcome;
  /** For "elsewhere": the universe the series is in. Its seasons were still brought up to date. */
  where?: string;
  seriesId: string;
  seasonsAdded: number[];
  seasonsUpdated: number[];
}

export interface ShowImportResult {
  universeId: string | null;
  report: ShowReportLine[];
  /** Shows TMDB could not give details for; nothing was written for them. */
  failed: { tmdbId: number; reason: string }[];
}

/**
 * Brings shows into the library — each as a series in `universeId`, or standalone when it is
 * null — with every numbered season. Importing a show again is how new seasons and episodes
 * arrive: see placeSeries and planSeasons for what may change.
 */
export async function importShows(
  universeId: string | null,
  tmdbIds: number[],
  watched: boolean,
  now: Date = new Date(),
): Promise<ShowImportResult> {
  if (universeId) {
    const universe = await db.tvUniverse.findUnique({ where: { id: universeId }, select: { id: true } });
    if (!universe) throw new TmdbError("Universe not found.", 404);
  }

  const { details, failed } = await showDetails([...new Set(tmdbIds)], todayKey(now));

  const report: ShowReportLine[] = [];
  for (const show of details) {
    try {
      report.push(await landShow(show, universeId, watched, now.getTime() + report.length * 1000));
    } catch (e) {
      // A series name taken in that universe between the check and the insert.
      if (isUniqueViolation(e)) throw new TmdbError("Another import ran at the same time — try again.", 409);
      throw e;
    }
  }
  return { universeId, report, failed };
}

const SERIES_FIELDS = {
  id: true, name: true, tmdbId: true, imdbId: true, universeId: true, universe: { select: { name: true } },
} as const;

function shape(row: { id: string; name: string; tmdbId: number | null; universeId: string | null; universe: { name: string } | null }): ExistingSeries {
  return { id: row.id, name: row.name, tmdbId: row.tmdbId, universeId: row.universeId, universeName: row.universe?.name ?? null };
}

async function landShow(
  show: TmdbShowDetails,
  universeId: string | null,
  watched: boolean,
  stamp: number,
): Promise<ShowReportLine> {
  return db.$transaction(async (tx) => {
    // Two imports of the same show at once (a double tap) take turns, so the second finds the
    // series the first made instead of making another.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${LOCK_NAMESPACE}::int, ${show.id}::int)`;

    const linked = await tx.tvSeries.findUnique({ where: { tmdbId: show.id }, select: SERIES_FIELDS });
    const siblings = linked ? [] : (await tx.tvSeries.findMany({ where: { universeId }, select: SERIES_FIELDS })).map(shape);
    const place = placeSeries(linked ? shape(linked) : null, siblings, show, universeId);

    let seriesId: string;
    let seriesName: string;
    if (place.action === "create") {
      const created = await tx.tvSeries.create({
        data: { name: place.name, universeId, tmdbId: show.id, imdbId: show.imdbId },
        select: { id: true, name: true },
      });
      seriesId = created.id;
      seriesName = created.name;
    } else {
      seriesId = place.id;
      seriesName = place.name;
      const data: { tmdbId?: number; imdbId?: string; universeId?: string } = {};
      if (place.link) data.tmdbId = show.id;
      if (show.imdbId && !(linked?.imdbId)) data.imdbId = show.imdbId;
      if (place.moveTo) data.universeId = place.moveTo;
      if (Object.keys(data).length > 0) await tx.tvSeries.update({ where: { id: seriesId }, data });
    }

    const existing = await tx.tvShow.findMany({
      where: { seriesId },
      select: {
        id: true, seasonNumber: true, totalEpisodes: true, episodesWatched: true, year: true,
        coverImage: true, creator: true, network: true,
      },
    });
    const plan = planSeasons(existing, show, { seriesName, watched });

    if (plan.create.length > 0) {
      // A series page lists seasons by number, then by when they were added; a millisecond
      // apart keeps the order exact even for rows one insert stamps at once.
      await tx.tvShow.createMany({
        data: plan.create.map((season, i) => ({ ...season, seriesId, createdAt: new Date(stamp + i) })),
      });
    }
    for (const { id, data } of plan.update) await tx.tvShow.update({ where: { id }, data });

    return {
      tmdbId: show.id,
      name: seriesName,
      outcome: place.outcome,
      ...(place.action === "use" && place.where ? { where: place.where } : {}),
      seriesId,
      seasonsAdded: plan.added,
      seasonsUpdated: plan.updated,
    };
  }, { timeout: 20_000 });
}

/** Which of these TMDB shows are in the library already, and where. For search and previews. */
export async function libraryShowPlaces(
  tmdbIds: number[],
): Promise<Map<number, { seriesId: string; universeId: string | null; universeName: string | null }>> {
  if (tmdbIds.length === 0) return new Map();
  const rows = await db.tvSeries.findMany({
    where: { tmdbId: { in: tmdbIds } },
    select: { id: true, tmdbId: true, universeId: true, universe: { select: { name: true } } },
  });
  return new Map(
    rows.map((s) => [s.tmdbId!, { seriesId: s.id, universeId: s.universeId, universeName: s.universe?.name ?? null }]),
  );
}
