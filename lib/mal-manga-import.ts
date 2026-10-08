// Landing a MyAnimeList manga in the library — one entry, one row. Server-only. The rules are in
// lib/mal-manga.ts; this is the database side of them.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { deriveStatus, mangaProgress, READ_STATUS } from "@/lib/derive-status";
import type { LanguageKey } from "@/lib/constants/languages";
import { NOVEL_MEDIA, matchExisting, rowFromManga, updatesFromManga, type MalManga } from "@/lib/mal-manga";
import { MalError, mangaEntry } from "@/lib/mal-service";

/** Where a MyAnimeList manga already is: linked to it, or added by hand under one of its titles. */
export interface MangaPlace {
  mangaId: string;
  title: string;
  /** false: added by hand — importing links that one instead of adding another. */
  linked: boolean;
}

const MATCH_FIELDS = { id: true, title: true, malId: true } as const;

/** The rows an entry could be: linked to one of these ids, or not linked to anything yet. */
function candidates(malIds: number[]) {
  return db.manga.findMany({ where: { OR: [{ malId: { in: malIds } }, { malId: null }] }, select: MATCH_FIELDS });
}

export async function libraryMangaPlaces(entries: MalManga[]): Promise<Map<number, MangaPlace>> {
  const places = new Map<number, MangaPlace>();
  if (entries.length === 0) return places;
  const library = await candidates(entries.map((m) => m.id));
  for (const m of entries) {
    const found = matchExisting(m, library);
    if (found) places.set(m.id, { mangaId: found.id, title: found.title, linked: found.malId === m.id });
  }
  return places;
}

export interface MangaImportResult {
  /** added: a new row. linked: a hand-added one now knows its entry. already: it was there. */
  outcome: "added" | "linked" | "already";
  mangaId: string;
  title: string;
}

const LINK_FIELDS = {
  id: true, title: true, malId: true, author: true, artist: true, totalVolumes: true, totalChapters: true,
  volumesRead: true, chaptersRead: true, ongoing: true, coverImage: true,
} as const;

type LinkRow = { id: string; title: string; malId: number | null; author: string; artist: string | null;
  totalVolumes: number | null; totalChapters: number | null; volumesRead: number; chaptersRead: number;
  ongoing: boolean; coverImage: string | null };

/** Fill a row's blanks from MyAnimeList (and link it). Your progress, title and notes stay. */
async function fillFrom(row: LinkRow, m: MalManga, link: boolean): Promise<string[]> {
  const changes = updatesFromManga(row, m);
  const changed = Object.keys(changes);
  if (!link && changed.length === 0) return changed;
  await db.manga.update({
    where: { id: row.id },
    data: {
      ...changes,
      ...(link ? { malId: m.id } : {}),
      // A series that just ended, with its final count, may now be finished.
      status: deriveStatus(mangaProgress({ ...row, ...changes }), READ_STATUS),
    },
  });
  return changed;
}

async function alreadyThere(malId: number): Promise<MangaImportResult> {
  const row = await db.manga.findUnique({ where: { malId }, select: { id: true, title: true } });
  if (!row) throw new MalError("Another import ran at the same time — try again.", 409);
  return { outcome: "already", mangaId: row.id, title: row.title };
}

/**
 * Brings one MyAnimeList manga into the library. If it is already there — linked, or added by hand
 * under one of its titles — that row is used, never a second one: a hand-added row is linked and
 * only its blanks are filled. With `mangaId`, it is that row that gets linked, whatever its title.
 */
export async function importManga(
  malId: number,
  { english, read, language, mangaId }: { english: boolean; read: boolean; language: LanguageKey; mangaId?: string },
): Promise<MangaImportResult> {
  const m = await mangaEntry(malId);
  if (NOVEL_MEDIA.has(m.mediaType)) {
    throw new MalError("That's a novel on MyAnimeList — add it under Books instead.", 400);
  }

  try {
    if (mangaId) {
      const row = await db.manga.findUnique({ where: { id: mangaId }, select: LINK_FIELDS });
      if (!row) throw new MalError("Manga not found.", 404);
      if (row.malId === m.id) return { outcome: "already", mangaId: row.id, title: row.title };
      if (row.malId !== null) throw new MalError("This manga is already linked to another MyAnimeList entry.", 409);
      const taken = await db.manga.findUnique({ where: { malId: m.id }, select: { title: true } });
      if (taken) throw new MalError(`"${taken.title}" in your library is already that entry.`, 409);
      await fillFrom(row, m, true);
      return { outcome: "linked", mangaId: row.id, title: row.title };
    }

    const found = matchExisting(m, await candidates([m.id]));
    if (found?.malId === m.id) return { outcome: "already", mangaId: found.id, title: found.title };
    if (found) {
      const row = await db.manga.findUniqueOrThrow({ where: { id: found.id }, select: LINK_FIELDS });
      await fillFrom(row, m, true);
      return { outcome: "linked", mangaId: row.id, title: row.title };
    }

    const data = { ...rowFromManga(m, { english, read }), language };
    const created = await db.manga.create({
      data: { ...data, status: deriveStatus(mangaProgress(data), READ_STATUS) },
      select: { id: true, title: true },
    });
    return { outcome: "added", mangaId: created.id, title: created.title };
  } catch (e) {
    // Imported (or linked) by another request between the check and the write.
    if (isUniqueViolation(e)) return alreadyThere(m.id);
    throw e;
  }
}

/**
 * "Check MyAnimeList" on a linked manga: the counts once a series ends or grows, a cover or an
 * artist it was missing. Returns the fields that changed — nothing you entered is overwritten.
 */
export async function refreshManga(mangaId: string): Promise<{ changed: string[] }> {
  const row = await db.manga.findUnique({ where: { id: mangaId }, select: LINK_FIELDS });
  if (!row) throw new MalError("Manga not found.", 404);
  if (row.malId === null) throw new MalError("This manga isn't linked to MyAnimeList.", 400);
  const m = await mangaEntry(row.malId);
  return { changed: await fillFrom(row, m, false) };
}
