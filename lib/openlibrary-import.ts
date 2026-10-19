// Landing catalogue books in the library. Server-only. The rules are in lib/openlibrary.ts.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { deriveStatus, bookProgress, BOOK_STATUS } from "@/lib/derive-status";
import type { LanguageKey } from "@/lib/constants/languages";
import { OpenLibraryError } from "@/lib/openlibrary-service";
import { catalogDetails, type CatalogItem } from "@/lib/book-catalog-service";
import { combineSources } from "@/lib/google-books";
import { workById } from "@/lib/openlibrary-service";
import { volumeById } from "@/lib/google-books-service";
import { GoogleBooksError } from "@/lib/google-books-service";
import {
  matchExisting, planImport, updatesFromWork,
  type CatalogBook, type ExistingBook, type ReportLine,
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
  id: true, title: true, author: true, openLibraryId: true, googleBooksId: true, publisher: true,
  pages: true, coverImage: true, seriesId: true, series: { select: { name: true } },
} as const;

function asExisting(row: {
  id: string; title: string; author: string; openLibraryId: string | null; googleBooksId: string | null;
  publisher: string | null; pages: number; coverImage: string | null; seriesId: string | null;
  series: { name: string } | null;
}): ExistingBook {
  return { ...row, seriesName: row.series?.name ?? null };
}

/** Every row that could match: linked to one of these ids, or matchable by title + author. */
async function candidates(): Promise<ExistingBook[]> {
  return (await db.book.findMany({ select: MATCH_FIELDS })).map(asExisting);
}

export async function libraryBookPlaces(works: CatalogBook[]): Promise<Map<string, BookPlace>> {
  const places = new Map<string, BookPlace>();
  if (works.length === 0) return places;
  const library = await candidates();
  for (const work of works) {
    const found = matchExisting(work, library);
    if (found) {
      const linked =
        (work.openLibraryId !== null && found.openLibraryId === work.openLibraryId) ||
        (work.googleBooksId !== null && found.googleBooksId === work.googleBooksId);
      places.set(work.id, {
        bookId: found.id,
        title: found.title,
        linked,
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
  failed: { id: string; reason: string }[];
}

const LINK_FIELDS = {
  id: true, title: true, author: true, openLibraryId: true, googleBooksId: true,
  coverImage: true, publisher: true,
} as const;

/**
 * Brings catalogue books into the library — into `seriesId`, or standalone when it is null.
 * New books get `language` and are marked read when asked; books already there keep theirs, and
 * only have blanks filled: see planImport. With `bookId`, that row is linked, whatever its title.
 */
export async function importWorks(
  items: CatalogItem[],
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
    if (items.length !== 1) throw new OpenLibraryError("Link one book at a time.", 400);
    return linkBook(bookId, items[0], seriesId);
  }

  const { works, failed } = await catalogDetails(items);
  const rows = await candidates();
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

  const added = plan.report.filter((line) => line.outcome === "added");
  if (added.length > 0) {
    const olIds = added.map((line) => line.openLibraryId).filter((id): id is string => id !== null);
    const gbIds = added.map((line) => line.googleBooksId).filter((id): id is string => id !== null);
    const created = await db.book.findMany({
      where: {
        OR: [
          ...(olIds.length ? [{ openLibraryId: { in: olIds } }] : []),
          ...(gbIds.length ? [{ googleBooksId: { in: gbIds } }] : []),
        ],
      },
      select: { id: true, openLibraryId: true, googleBooksId: true },
    });
    const byOl = new Map(created.filter((b) => b.openLibraryId).map((b) => [b.openLibraryId!, b.id]));
    const byGb = new Map(created.filter((b) => b.googleBooksId).map((b) => [b.googleBooksId!, b.id]));
    for (const line of plan.report) {
      if (line.outcome !== "added") continue;
      line.bookId = (line.openLibraryId && byOl.get(line.openLibraryId))
        || (line.googleBooksId && byGb.get(line.googleBooksId))
        || undefined;
    }
  }

  return { seriesId, report: plan.report, failed };
}

async function fetchCatalogItem(item: CatalogItem): Promise<CatalogBook> {
  let ol = null;
  let gb = null;
  if (item.openLibraryId) {
    try {
      ol = await workById(item.openLibraryId);
    } catch (e) {
      if (!(e instanceof OpenLibraryError) || (e.status !== 404 && e.status !== 400)) throw e;
    }
  }
  if (item.googleBooksId) {
    try {
      gb = await volumeById(item.googleBooksId);
    } catch (e) {
      if (e instanceof GoogleBooksError && (e.status === 404 || e.status === 400)) {
        gb = null;
      } else if (ol) {
        gb = null;
      } else {
        throw e;
      }
    }
  }
  let combined = combineSources(ol, gb, item.title ?? "");
  if (!combined) throw new OpenLibraryError("That isn't in the catalogues.", 404);
  const preferred = item.title?.trim();
  if (preferred) combined = { ...combined, title: preferred };
  return combined;
}

async function linkBook(bookId: string, item: CatalogItem, seriesId: string | null): Promise<ImportResult> {
  const work = await fetchCatalogItem(item);
  const row = await db.book.findUnique({ where: { id: bookId }, select: LINK_FIELDS });
  if (!row) throw new OpenLibraryError("Book not found.", 404);

  if (work.openLibraryId && row.openLibraryId && row.openLibraryId !== work.openLibraryId) {
    throw new OpenLibraryError("This book is already linked to another Open Library work.", 409);
  }
  if (work.googleBooksId && row.googleBooksId && row.googleBooksId !== work.googleBooksId) {
    throw new OpenLibraryError("This book is already linked to another Google Books volume.", 409);
  }

  const alreadyLinked =
    (!work.openLibraryId || row.openLibraryId === work.openLibraryId) &&
    (!work.googleBooksId || row.googleBooksId === work.googleBooksId);
  if (alreadyLinked && (row.openLibraryId !== null || row.googleBooksId !== null)) {
    return {
      seriesId,
      report: [{
        id: work.id,
        openLibraryId: work.openLibraryId,
        googleBooksId: work.googleBooksId,
        title: row.title,
        year: work.year,
        outcome: "already",
        bookId: row.id,
      }],
      failed: [],
    };
  }

  if (work.openLibraryId) {
    const taken = await db.book.findFirst({
      where: { openLibraryId: work.openLibraryId, NOT: { id: row.id } },
      select: { title: true },
    });
    if (taken) throw new OpenLibraryError(`"${taken.title}" in your library is already that work.`, 409);
  }
  if (work.googleBooksId) {
    const taken = await db.book.findFirst({
      where: { googleBooksId: work.googleBooksId, NOT: { id: row.id } },
      select: { title: true },
    });
    if (taken) throw new OpenLibraryError(`"${taken.title}" in your library is already that volume.`, 409);
  }

  const changes = updatesFromWork(row, work);
  try {
    await db.book.update({
      where: { id: row.id },
      data: {
        ...changes,
        ...(work.openLibraryId && !row.openLibraryId ? { openLibraryId: work.openLibraryId } : {}),
        ...(work.googleBooksId && !row.googleBooksId ? { googleBooksId: work.googleBooksId } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new OpenLibraryError("Another import ran at the same time — try again.", 409);
    throw e;
  }
  return {
    seriesId,
    report: [{
      id: work.id,
      openLibraryId: work.openLibraryId,
      googleBooksId: work.googleBooksId,
      title: row.title,
      year: work.year,
      outcome: "linked",
      bookId: row.id,
    }],
    failed: [],
  };
}

/**
 * "Check catalogues" on a linked book: a cover, author or publisher it was missing. Returns the
 * fields that changed — nothing you entered is overwritten.
 */
export async function refreshBook(bookId: string): Promise<{ changed: string[] }> {
  const row = await db.book.findUnique({
    where: { id: bookId },
    select: { id: true, author: true, openLibraryId: true, googleBooksId: true, coverImage: true, publisher: true },
  });
  if (!row) throw new OpenLibraryError("Book not found.", 404);
  if (row.openLibraryId === null && row.googleBooksId === null) {
    throw new OpenLibraryError("This book isn't linked to a catalogue.", 400);
  }
  const work = await fetchCatalogItem({
    ...(row.openLibraryId ? { openLibraryId: row.openLibraryId } : {}),
    ...(row.googleBooksId ? { googleBooksId: row.googleBooksId } : {}),
  });
  const changes = updatesFromWork(row, work);
  const changed = Object.keys(changes);
  if (changed.length === 0) return { changed };
  await db.book.update({ where: { id: row.id }, data: changes });
  return { changed };
}
