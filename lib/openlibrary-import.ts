// Landing catalogue books in the library. Server-only. The rules are in lib/openlibrary.ts.

import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { deriveStatus, bookProgress, BOOK_STATUS } from "@/lib/derive-status";
import type { LanguageKey } from "@/lib/constants/languages";
import { BookCatalogError, matchExisting, planImport, updatesFromWork, type CatalogBook, type ExistingBook, type ReportLine } from "@/lib/openlibrary";
import { catalogDetails, type CatalogItem } from "@/lib/book-catalog-service";
import { fromGbVolume } from "@/lib/google-books";
import { volumeById } from "@/lib/google-books-service";

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
      // Linked to Google Books at all — any edition — is in the library, not a hand-added row.
      const linked = found.googleBooksId !== null;
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
 * Brings Google Books volumes into the library — into `seriesId`, or standalone when it is null.
 * New books get `language`, and are marked read, physically owned, or owned on Kindle when asked.
 * Books already there keep theirs, and only have blanks filled: see planImport. With `bookId`,
 * that row is linked, whatever its title.
 */
export async function importWorks(
  items: CatalogItem[],
  { read, language, seriesId, owned, ownedKindle, bookId }: {
    read: boolean;
    language: LanguageKey;
    seriesId: string | null;
    owned: boolean;
    ownedKindle: boolean;
    bookId?: string;
  },
): Promise<ImportResult> {
  if (seriesId) {
    const series = await db.bookSeries.findUnique({ where: { id: seriesId }, select: { id: true } });
    if (!series) throw new BookCatalogError("Series not found.", 404);
  }

  if (bookId) {
    if (items.length !== 1) throw new BookCatalogError("Link one book at a time.", 400);
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
          owned,
          ownedKindle,
          seriesId,
          status: deriveStatus(bookProgress(book), BOOK_STATUS),
          createdAt: new Date(now + i),
        })),
        skipDuplicates: true,
      }),
      ...plan.update.map(({ id, data }) => db.book.update({ where: { id }, data })),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) throw new BookCatalogError("Another import ran at the same time — try again.", 409);
    throw e;
  }

  const added = plan.report.filter((line) => line.outcome === "added");
  if (added.length > 0) {
    const gbIds = added.map((line) => line.googleBooksId).filter((id): id is string => id !== null);
    const created = gbIds.length
      ? await db.book.findMany({
          where: { googleBooksId: { in: gbIds } },
          select: { id: true, googleBooksId: true },
        })
      : [];
    const byGb = new Map(created.filter((b) => b.googleBooksId).map((b) => [b.googleBooksId!, b.id]));
    for (const line of plan.report) {
      if (line.outcome !== "added") continue;
      line.bookId = (line.googleBooksId && byGb.get(line.googleBooksId)) || undefined;
    }
  }

  return { seriesId, report: plan.report, failed };
}

async function fetchVolume(item: CatalogItem): Promise<CatalogBook> {
  const volume = await volumeById(item.googleBooksId);
  let book = fromGbVolume(volume);
  const preferred = item.title?.trim();
  if (preferred) book = { ...book, title: preferred };
  return book;
}

async function linkBook(bookId: string, item: CatalogItem, seriesId: string | null): Promise<ImportResult> {
  const work = await fetchVolume(item);
  const row = await db.book.findUnique({ where: { id: bookId }, select: LINK_FIELDS });
  if (!row) throw new BookCatalogError("Book not found.", 404);

  if (work.googleBooksId && row.googleBooksId && row.googleBooksId !== work.googleBooksId) {
    throw new BookCatalogError("This book is already linked to another Google Books volume.", 409);
  }

  if (row.googleBooksId === work.googleBooksId) {
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

  if (work.googleBooksId) {
    const taken = await db.book.findFirst({
      where: { googleBooksId: work.googleBooksId, NOT: { id: row.id } },
      select: { title: true },
    });
    if (taken) throw new BookCatalogError(`"${taken.title}" in your library is already that volume.`, 409);
  }

  const changes = updatesFromWork(row, work);
  try {
    await db.book.update({
      where: { id: row.id },
      data: {
        ...changes,
        ...(work.googleBooksId && !row.googleBooksId ? { googleBooksId: work.googleBooksId } : {}),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new BookCatalogError("Another import ran at the same time — try again.", 409);
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
 * "Check Google Books" on a linked book: a cover, author or publisher it was missing. Returns the
 * fields that changed — nothing you entered is overwritten.
 */
export async function refreshBook(bookId: string): Promise<{ changed: string[] }> {
  const row = await db.book.findUnique({
    where: { id: bookId },
    select: { id: true, author: true, googleBooksId: true, coverImage: true, publisher: true },
  });
  if (!row) throw new BookCatalogError("Book not found.", 404);
  if (row.googleBooksId === null) {
    throw new BookCatalogError("This book isn't linked to Google Books.", 400);
  }
  const work = await fetchVolume({ googleBooksId: row.googleBooksId });
  const changes = updatesFromWork(row, work);
  const changed = Object.keys(changes);
  if (changed.length === 0) return { changed };
  await db.book.update({ where: { id: row.id }, data: changes });
  return { changed };
}
