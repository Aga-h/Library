// Importing books from Open Library: reading its search answers, and the rules for landing a
// work in the library. A work is the book itself (every paperback of Philosopher's Stone is the
// same work), so `Book.openLibraryId` is unique.
//
// Pure and dependency-free, so the tests exercise every rule without a network or a database
// (scripts/test-openlibrary.mjs). The API client is lib/openlibrary-service.ts; the database
// side is lib/openlibrary-import.ts.
//
// Open Library is used because it is the official, documented API of a project of the Internet
// Archive: no key, work-level identity, ISBN lookup, covers, and a page-count median across
// editions. Google Books was the other candidate — edition-centric (the same novel is many
// volumes), needs an API key, no first-class series. Goodreads has no public API. Catalog data
// is stored as Open Library gives it; publisher is not, because a work lists every edition's
// publisher and the first is rarely the one you'd pick.

import type { LanguageKey } from "@/lib/constants/languages";
import { normaliseTitle, type Outcome } from "@/lib/tmdb";

export const OL_IMAGE_HOST = "covers.openlibrary.org";

/** Open Library's attribution, shown wherever its data is used. */
export const OL_NOTICE =
  "Book data from Open Library, a project of the Internet Archive.";

export const OL_NOTICE_HREF = "https://openlibrary.org";

/** How many works one import may bring in. A search never offers more than this. */
export const MAX_IMPORT = 40;

export interface OlWork {
  /** "OL82563W" — the work, not an edition. */
  id: string;
  title: string;
  author: string;
  year: number | null;
  /** Median pages across editions. null when Open Library doesn't know — can't be imported. */
  pages: number | null;
  cover: string | null;
  /** Smaller cover for search rows. */
  coverThumb: string | null;
}

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Open Library's work key as we store it: "OL82563W". Search returns "/works/OL82563W" or the
 * bare id; either is accepted. Anything else is refused rather than stitched into a URL.
 */
export function workIdOf(value: unknown): string | null {
  const raw = text(value);
  const m = raw.match(/^(?:\/works\/)?(OL\d+W)$/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * An ISBN typed or pasted into search: hyphens and spaces don't count. ISBN-13 must start
 * 978/979; ISBN-10 may end in X.
 */
export function isbnOf(query: string): string | null {
  const compact = query.replace(/[-\s]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(compact)) return compact;
  if (/^\d{9}[\dX]$/.test(compact)) return compact;
  return null;
}

/** The query Open Library is asked: an ISBN, a pasted work key, or the words as typed. */
export function searchQueryOf(query: string): string {
  const isbn = isbnOf(query);
  if (isbn) return `isbn:${isbn}`;
  const id = workIdOf(query);
  if (id) return `key:/works/${id}`;
  return query.trim();
}

/**
 * Cover URL at one of Open Library's fixed sizes. -L is stored (sharp on a card at twice its
 * size); -M is the search thumbnail. A missing or non-positive cover id is refused — their
 * CDN otherwise serves a 1×1 placeholder.
 */
export function coverUrl(coverId: unknown, size: "M" | "L" = "L"): string | null {
  const id = positiveInt(coverId);
  if (id === null) return null;
  return `https://${OL_IMAGE_HOST}/b/id/${id}-${size}.jpg`;
}

/** Covers are shown straight from Open Library's CDN — see app/api/books/mirror-covers. */
export function isOpenLibraryImage(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    return new URL(src).hostname === OL_IMAGE_HOST;
  } catch {
    return false;
  }
}

/** Authors joined in Open Library's order. Nobody credited → "Unknown", the required column. */
export function authorsOf(names: unknown): string {
  if (!Array.isArray(names)) return "Unknown";
  const joined = names.map(text).filter(Boolean).join(", ");
  return joined || "Unknown";
}

/** "1997", checked. Open Library sends first_publish_year as a number. */
export function yearOf(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1000 && n <= 2100 ? n : null;
}

/** A search/work document, or null if it's unusable (no work id or no title). */
export function toWork(raw: Raw | null | undefined): OlWork | null {
  if (!raw) return null;
  const id = workIdOf(raw.key);
  const title = text(raw.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    author: authorsOf(raw.author_name),
    year: yearOf(raw.first_publish_year),
    pages: positiveInt(raw.number_of_pages_median),
    cover: coverUrl(raw.cover_i, "L"),
    coverThumb: coverUrl(raw.cover_i, "M"),
  };
}

export function hasPages(work: OlWork): work is OlWork & { pages: number } {
  return work.pages !== null;
}

/**
 * Authors compared loosely: case, punctuation and spacing don't count, so "J. K. Rowling"
 * matches a typed "JK Rowling".
 */
export function normaliseAuthor(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function authorUnknown(name: string): boolean {
  return normaliseAuthor(name) === "unknown" || name.trim() === "";
}

export interface ExistingBook {
  id: string;
  title: string;
  author: string;
  openLibraryId: string | null;
  publisher: string | null;
  pages: number;
  coverImage: string | null;
  seriesId: string | null;
  seriesName: string | null;
}

/**
 * A book already in the library that this work is — by Open Library id, or else a hand-added
 * one (no Open Library link yet) whose title matches and whose author matches (or either side
 * is "Unknown"). Matching on the normalised title means "the hobbit" typed by hand is found by
 * "The Hobbit".
 */
export function matchExisting<T extends ExistingBook>(work: OlWork, library: readonly T[]): T | null {
  const linked = library.find((x) => x.openLibraryId === work.id);
  if (linked) return linked;
  const title = normaliseTitle(work.title);
  return (
    library.find((x) => {
      if (x.openLibraryId !== null) return false;
      if (normaliseTitle(x.title) !== title) return false;
      return authorUnknown(x.author) || authorUnknown(work.author) || normaliseAuthor(x.author) === normaliseAuthor(work.author);
    }) ?? null
  );
}

export interface NewBook {
  title: string;
  author: string;
  pages: number;
  pagesRead: number;
  coverImage: string | null;
  openLibraryId: string;
}

export interface BookUpdate {
  id: string;
  data: {
    openLibraryId?: string;
    author?: string;
    coverImage?: string;
    /** Into the series being imported into: only ever from standalone. */
    seriesId?: string;
  };
}

export interface ReportLine {
  openLibraryId: string;
  title: string;
  year: number | null;
  outcome: Outcome;
  /** For "elsewhere": the series it is in. */
  where?: string;
  bookId?: string;
}

export interface ImportPlan {
  create: NewBook[];
  update: BookUpdate[];
  report: ReportLine[];
}

/**
 * Lands a batch of Open Library works in the library, in `seriesId` (or standalone, when null).
 *
 * A work is matched to a library row by its Open Library id, or else — once — to a book added
 * by hand with the same title and author. The merge only ever adds:
 *
 *  - Blanks get filled: a cover, and an author of "Unknown". Everything you set yourself —
 *    title, pages, pages read, rating, rereads, notes, language, publisher, a cover you chose —
 *    is never touched. Page counts vary by edition, so a stored one is never overwritten.
 *  - A standalone book moves into the series it is imported into. A book in a different series
 *    stays where it is and is reported — which series is your call, not an import's.
 */
export function planImport(
  existing: ExistingBook[],
  incoming: (OlWork & { pages: number })[],
  seriesId: string | null,
  { read }: { read: boolean },
): ImportPlan {
  const plan: ImportPlan = { create: [], update: [], report: [] };
  const byOl = new Map<string, ExistingBook>();
  const handAdded: ExistingBook[] = [];
  for (const book of existing) {
    if (book.openLibraryId === null) handAdded.push(book);
    else byOl.set(book.openLibraryId, book);
  }
  const claimed = new Set<string>();
  const seen = new Set<string>();

  for (const work of incoming) {
    if (seen.has(work.id)) continue;
    seen.add(work.id);

    const current = byOl.get(work.id) ?? matchExisting(work, handAdded.filter((b) => !claimed.has(b.id)));
    if (!current) {
      plan.create.push({
        title: work.title,
        author: work.author,
        pages: work.pages,
        pagesRead: read ? work.pages : 0,
        coverImage: work.cover,
        openLibraryId: work.id,
      });
      plan.report.push({ openLibraryId: work.id, title: work.title, year: work.year, outcome: "added" });
      continue;
    }
    claimed.add(current.id);

    const data: BookUpdate["data"] = {};
    if (current.openLibraryId === null) data.openLibraryId = work.id;
    if (authorUnknown(current.author) && !authorUnknown(work.author)) data.author = work.author;
    if (!current.coverImage && work.cover) data.coverImage = work.cover;

    let outcome: Outcome;
    let where: string | undefined;
    if (current.seriesId === seriesId) {
      outcome = current.openLibraryId === null ? "linked" : "already";
    } else if (current.seriesId === null) {
      data.seriesId = seriesId!;
      outcome = "moved";
    } else {
      outcome = "elsewhere";
      where = current.seriesName ?? "another series";
    }

    if (Object.keys(data).length > 0) plan.update.push({ id: current.id, data });
    plan.report.push({
      openLibraryId: work.id,
      title: current.title,
      year: work.year,
      outcome,
      ...(where ? { where } : {}),
      bookId: current.id,
    });
  }

  return plan;
}

export interface BookFields {
  author: string;
  coverImage: string | null;
}

/**
 * What Open Library may change on a book already in the library — when linking a hand-added
 * one, or checking a linked one again. Only blanks are filled: your title, pages, progress,
 * rating, notes, language and publisher are never touched.
 */
export function updatesFromWork(existing: BookFields, work: OlWork): Partial<BookFields> {
  const out: Partial<BookFields> = {};
  if (authorUnknown(existing.author) && !authorUnknown(work.author)) out.author = work.author;
  if (!existing.coverImage && work.cover) out.coverImage = work.cover;
  return out;
}

/**
 * The order a batch is listed — and so imported — in: by first publish year, undated last,
 * then by title with numbers read as numbers ("Part 2" before "Part 10").
 */
export function byYear<T extends { year: number | null; title: string }>(a: T, b: T): number {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  }
  return a.title.localeCompare(b.title, undefined, { numeric: true });
}

/** Re-export so callers don't have to reach into tmdb for the language type. */
export type { LanguageKey, Outcome };
