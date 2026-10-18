// Landing Open Library works in the library. Server-only. The rules are in lib/openlibrary.ts.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { deriveStatus, bookProgress, BOOK_STATUS } from "@/lib/derive-status";
import type { LanguageKey } from "@/lib/constants/languages";
import { OpenLibraryError, workById, workDetails } from "@/lib/openlibrary-service";
import {
  matchExisting, planImport, updatesFromWork,
  type ExistingBook, type OlWork, type ReportLine,
} from "@/lib/openlibrary";

export interface BookPlace {
  bookId: string;
  title: string;
  /** false: added by hand — importing links that one instead of adding another. */
  linked: boolean;
  seriesId: string | null;
  seriesName: string | null;
}

const MATCH_FIELDS = {
  id: true, title: true, author: true, openLibraryId: true, publisher: true,
  pages: true, coverImage: true, seriesId: true, series: { select: { name: true } },
} as const;

function asExisting(row: {
  id: string; title: string; author: string; openLibraryId: string | null; publisher: string | null;
  pages: number; coverImage: string | null; seriesId: string | null; series: { name: string } | null;
}): ExistingBook {
  return { ...row, seriesName: row.series?.name ?? null };
}

/** The rows an entry could be: linked to one of these ids, or not linked to anything yet. */
function candidates(ids: string[]) {
  return db.book.findMany({
    where: { OR: [{ openLibraryId: { in: ids } }, { openLibraryId: null }] },
    select: MATCH_FIELDS,
  });
}

export async function libraryBookPlaces(works: OlWork[]): Promise<Map<string, BookPlace>> {
  const places = new Map<string, BookPlace>();
  if (works.length === 0) return places;
  const library = (await candidates(works.map((w) => w.id))).map(asExisting);
  for (const work of works) {
    const found = matchExisting(work, library);
    if (found) {
      places.set(work.id, {
        bookId: found.id,
        title: found.title,
        linked: found.openLibraryId === work.id,
        seriesId: found.seriesId,
        seriesName: found.seriesName,
      });
    }
  }
  return places;
}

export interface ImportResult {
  seriesId: string | null;
  report: ReportLine[];
  failed: { openLibraryId: string; reason: string }[];
}

const LINK_FIELDS = {
  id: true, title: true, author: true, openLibraryId: true, coverImage: true,
} as const;

/**
 * Brings Open Library works into the library — into `seriesId`, or standalone when it is null.
 * New books get `language` and are marked read when asked; books already there keep theirs, and
 * only have blanks filled: see planImport. With `bookId`, that row is linked, whatever its title.
 */
export async function importWorks(
  workIds: string[],
  { read, language, seriesId, bookId }: {
    read: boolean;
    language: LanguageKey;
    seriesId: string | null;
    bookId?: string;
  },
): Promise<ImportResult> {
  if (seriesId) {
    const series = await db.bookSeries.findUnique({ where: { id: seriesId }, select: { id: true } });
    if (!series) throw new OpenLibraryError("Series not found.", 404);
  }

  if (bookId) {
    if (workIds.length !== 1) throw new OpenLibraryError("Link one book at a time.", 400);
    return linkBook(bookId, workIds[0], seriesId);
  }

  const { works, failed } = await workDetails(workIds);
  const rows = (await candidates(works.map((w) => w.id))).map(asExisting);
  const plan = planImport(rows, works, seriesId, { read });

  const now = Date.now();
  try {
    await db.$transaction([
      db.book.createMany({
        data: plan.create.map((book, i) => ({
          ...book,
          language,
          seriesId,
          status: deriveStatus(bookProgress(book), BOOK_STATUS),
          createdAt: new Date(now + i),
        })),
        skipDuplicates: true,
      }),
      ...plan.update.map(({ id, data }) => db.book.update({ where: { id }, data })),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) throw new OpenLibraryError("Another import ran at the same time — try again.", 409);
    throw e;
  }

  const added = plan.report.filter((line) => line.outcome === "added").map((line) => line.openLibraryId);
  if (added.length > 0) {
    const created = await db.book.findMany({
      where: { openLibraryId: { in: added } },
      select: { id: true, openLibraryId: true },
    });
    const idFor = new Map(created.map((b) => [b.openLibraryId, b.id]));
    for (const line of plan.report) {
      if (line.outcome === "added") line.bookId = idFor.get(line.openLibraryId);
    }
  }

  return { seriesId, report: plan.report, failed };
}

async function linkBook(bookId: string, workId: string, seriesId: string | null): Promise<ImportResult> {
  const work = await workById(workId);
  const row = await db.book.findUnique({ where: { id: bookId }, select: LINK_FIELDS });
  if (!row) throw new OpenLibraryError("Book not found.", 404);
  if (row.openLibraryId === work.id) {
    return { seriesId, report: [{ openLibraryId: work.id, title: row.title, year: work.year, outcome: "already", bookId: row.id }], failed: [] };
  }
  if (row.openLibraryId !== null) {
    throw new OpenLibraryError("This book is already linked to another Open Library work.", 409);
  }
  const taken = await db.book.findUnique({ where: { openLibraryId: work.id }, select: { title: true } });
  if (taken) throw new OpenLibraryError(`"${taken.title}" in your library is already that work.`, 409);

  const changes = updatesFromWork(row, work);
  try {
    await db.book.update({
      where: { id: row.id },
      data: { ...changes, openLibraryId: work.id },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new OpenLibraryError("Another import ran at the same time — try again.", 409);
    throw e;
  }
  return {
    seriesId,
    report: [{ openLibraryId: work.id, title: row.title, year: work.year, outcome: "linked", bookId: row.id }],
    failed: [],
  };
}

/**
 * "Check Open Library" on a linked book: a cover or an author it was missing. Returns the
 * fields that changed — nothing you entered is overwritten.
 */
export async function refreshBook(bookId: string): Promise<{ changed: string[] }> {
  const row = await db.book.findUnique({
    where: { id: bookId },
    select: { id: true, author: true, openLibraryId: true, coverImage: true },
  });
  if (!row) throw new OpenLibraryError("Book not found.", 404);
  if (row.openLibraryId === null) throw new OpenLibraryError("This book isn't linked to Open Library.", 400);
  const work = await workById(row.openLibraryId);
  const changes = updatesFromWork(row, work);
  const changed = Object.keys(changes);
  if (changed.length === 0) return { changed };
  await db.book.update({ where: { id: row.id }, data: changes });
  return { changed };
}
