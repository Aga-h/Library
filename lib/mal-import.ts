// Landing MyAnimeList entries in the library: a run as a series, one row per entry. Server-only.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import {
  UNTICKED_MEDIA, byAiring, chooseSeries, matchEntries, planEntries, titleFor,
  type EntryLine, type ExistingAnime, type MalEntry,
} from "@/lib/mal";
import { MalError, entryDetails, walkRun } from "@/lib/mal-service";

/** Advisory-lock namespace for anime imports, so they never wait on some unrelated lock. */
const LOCK_NAMESPACE = 7_302_432;

export interface RunImportResult {
  universeId: string | null;
  /** The series the run landed in; null for a single standalone anime. */
  seriesId: string | null;
  seriesName: string | null;
  seriesOutcome: "added" | "already" | "moved" | "linked" | "elsewhere" | null;
  /** For "elsewhere": the universe that series is in. New entries joined it there. */
  where?: string;
  entries: EntryLine[];
  /** Entries MyAnimeList could not give details for; nothing was written for them. */
  failed: { malId: number; reason: string }[];
}

/**
 * Brings MyAnimeList entries — normally one run, picked from a preview — into the library, in
 * `universeId` (standalone when null). See chooseSeries and planEntries for where they land and
 * what may change. Importing again is how new seasons arrive.
 */
export async function importRun(
  universeId: string | null,
  malIds: number[],
  { watched, english }: { watched: boolean; english: boolean },
  now: Date = new Date(),
): Promise<RunImportResult> {
  if (universeId) {
    const universe = await db.animeUniverse.findUnique({ where: { id: universeId }, select: { id: true } });
    if (!universe) throw new MalError("Universe not found.", 404);
  }

  const { entries, failed } = await entryDetails([...new Set(malIds)]);
  if (entries.length === 0) return { universeId, seriesId: null, seriesName: null, seriesOutcome: null, entries: [], failed };

  try {
    return { ...(await land(entries, universeId, { watched, english }, now.getTime())), failed };
  } catch (e) {
    // A series name taken in that universe between the check and the insert.
    if (isUniqueViolation(e)) throw new MalError("Another import ran at the same time — try again.", 409);
    throw e;
  }
}

const ROW_FIELDS = {
  id: true, title: true, year: true, malId: true, studio: true, episodes: true, episodesWatched: true,
  season: true, coverImage: true, seasonNumber: true, seriesId: true,
  series: { select: { name: true, universeId: true, universe: { select: { name: true } } } },
} as const;

async function land(
  entries: MalEntry[],
  universeId: string | null,
  options: { watched: boolean; english: boolean },
  stamp: number,
): Promise<Omit<RunImportResult, "failed">> {
  return db.$transaction(async (tx) => {
    // Two imports touching the same entries (a double tap) take turns, so the second finds what
    // the first made. Locks are taken in id order, so two overlapping imports cannot deadlock.
    for (const id of entries.map((e) => e.id).sort((a, b) => a - b)) {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${LOCK_NAMESPACE}::int, ${id}::int)`;
    }

    // Anime added by hand are all candidates for a title match; the library is small enough
    // that reading them is cheaper than a fuzzy title query per entry.
    const rows = await tx.anime.findMany({
      where: { OR: [{ malId: { in: entries.map((e) => e.id) } }, { malId: null }] },
      select: ROW_FIELDS,
    });
    const existing: ExistingAnime[] = rows.map(({ series, ...r }) => ({
      ...r,
      seriesName: series?.name ?? null,
      seriesUniverseId: series?.universeId ?? null,
      seriesUniverseName: series?.universe?.name ?? null,
    }));
    const matches = matchEntries(existing, entries);

    const first = [...entries].sort(byAiring)[0];
    const siblings = (await tx.animeSeries.findMany({
      where: { universeId },
      select: { id: true, name: true, _count: { select: { anime: { where: { malId: { not: null } } } } } },
    })).map((s) => ({ id: s.id, name: s.name, fromMal: s._count.anime > 0 }));
    const choice = chooseSeries(
      matches,
      siblings,
      { name: titleFor(first, options.english), year: first.year, firstId: first.id, count: entries.length },
      universeId,
    );

    let seriesId: string | null = null;
    let seriesName: string | null = null;
    if (choice.action === "create") {
      const created = await tx.animeSeries.create({ data: { name: choice.name, universeId }, select: { id: true, name: true } });
      seriesId = created.id;
      seriesName = created.name;
    } else if (choice.action === "use") {
      seriesId = choice.id;
      seriesName = choice.name;
      if (choice.moveTo) await tx.animeSeries.update({ where: { id: seriesId }, data: { universeId: choice.moveTo } });
    }

    const highest = seriesId
      ? (await tx.anime.aggregate({ where: { seriesId }, _max: { seasonNumber: true } }))._max.seasonNumber ?? 0
      : 0;
    const plan = planEntries(entries, matches, { id: seriesId, highestSeason: highest }, options);

    if (plan.create.length > 0) {
      // A series page lists entries by season number, then by when they were added.
      await tx.anime.createMany({
        data: plan.create.map((anime, i) => ({ ...anime, seriesId, createdAt: new Date(stamp + i) })),
      });
    }
    for (const { id, data } of plan.update) await tx.anime.update({ where: { id }, data });

    const added = plan.report.filter((line) => line.outcome === "added").map((line) => line.malId);
    if (added.length > 0) {
      const created = await tx.anime.findMany({ where: { malId: { in: added } }, select: { id: true, malId: true } });
      const idFor = new Map(created.map((a) => [a.malId, a.id]));
      for (const line of plan.report) if (line.outcome === "added") line.animeId = idFor.get(line.malId);
    }

    return {
      universeId,
      seriesId,
      seriesName,
      seriesOutcome: choice.action === "create" ? "added" : choice.action === "use" ? choice.outcome : null,
      ...(choice.action === "use" && choice.where ? { where: choice.where } : {}),
      entries: plan.report,
    };
  }, { timeout: 20_000 });
}

/**
 * "Check for new seasons" on a series: walk the run again from one of its MyAnimeList entries and
 * import what is newer than the newest entry the series has — so entries left out on purpose at
 * the first import are not pushed back in. Titles follow the language the series already uses.
 */
export async function refreshSeries(seriesId: string): Promise<RunImportResult> {
  const series = await db.animeSeries.findUnique({
    where: { id: seriesId },
    select: { universeId: true, anime: { where: { malId: { not: null } }, select: { malId: true, title: true } } },
  });
  if (!series) throw new MalError("Series not found.", 404);
  if (series.anime.length === 0) throw new MalError("Nothing in this series came from MyAnimeList.", 400);

  const { entries } = await walkRun(series.anime[0].malId!);
  const mine = new Map(series.anime.map((a) => [a.malId!, a.title]));
  const have = entries.filter((e) => mine.has(e.id));
  const newest = have.map((e) => e.startDate).filter((d): d is string => d !== null).sort().at(-1) ?? null;
  // Music videos and promos are left out, as the preview leaves them unticked.
  const fresh = entries.filter((e) => !mine.has(e.id) && !UNTICKED_MEDIA.has(e.mediaType) &&
    (newest === null || e.startDate === null || e.startDate > newest));
  // English if any of yours carries MAL's English title rather than its main one.
  const english = have.some((e) => e.titleEn !== null && mine.get(e.id) === e.titleEn);

  // Re-importing what it has too fills their blanks and raises episode counts still growing.
  return importRun(series.universeId, [...have, ...fresh].map((e) => e.id), { watched: false, english });
}

/** Which of these entries are in the library already, and where. For search and previews. */
export async function libraryAnimePlaces(
  malIds: number[],
): Promise<Map<number, { animeId: string; seriesId: string | null; seriesName: string | null; universeId: string | null; universeName: string | null }>> {
  if (malIds.length === 0) return new Map();
  const rows = await db.anime.findMany({
    where: { malId: { in: malIds } },
    select: { id: true, malId: true, seriesId: true, series: { select: { name: true, universeId: true, universe: { select: { name: true } } } } },
  });
  return new Map(rows.map((a) => [a.malId!, {
    animeId: a.id,
    seriesId: a.seriesId,
    seriesName: a.series?.name ?? null,
    universeId: a.series?.universeId ?? null,
    universeName: a.series?.universe?.name ?? null,
  }]));
}
