// Importing books: reading Open Library's search answers, and the rules for landing a work in
// the library. A work is the book itself (every paperback of Philosopher's Stone is the same
// work), so `Book.openLibraryId` is unique. Google Books is the second catalogue (`googleBooksId`)
// for titles Open Library hasn't got; same fill-blanks merge, matched by either id or title+author.
//
// Pure and dependency-free, so the tests exercise every rule without a network or a database
// (scripts/test-openlibrary.mjs). The API client is lib/openlibrary-service.ts; the database
// side is lib/openlibrary-import.ts. Google Books parsing is lib/google-books.ts.
//
// Open Library is the official API of a project of the Internet Archive: no key, work-level
// identity, ISBN lookup, covers, and a page-count median across editions. Google Books is
// edition-centric (the same novel is many volumes) and wants an API key — search still works
// without it, and a 403/429 there must not hide Open Library hits. Goodreads has no public API.
// Publisher is taken from Google Books (one edition, one name), never from Open Library (a work
// lists every edition's publisher and the first is rarely the one you'd pick).

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

/**
 * One row in Add Book, after Open Library and Google Books have been merged. `id` is the Open
 * Library work id when we have one, otherwise `gb:{googleBooksId}`.
 */
export interface CatalogBook {
  id: string;
  title: string;
  author: string;
  year: number | null;
  pages: number | null;
  cover: string | null;
  coverThumb: string | null;
  publisher: string | null;
  openLibraryId: string | null;
  googleBooksId: string | null;
}

export function fromOlWork(work: OlWork): CatalogBook {
  return {
    id: work.id,
    title: work.title,
    author: work.author,
    year: work.year,
    pages: work.pages,
    cover: work.cover,
    coverThumb: work.coverThumb,
    publisher: null,
    openLibraryId: work.id,
    googleBooksId: null,
  };
}

export function catalogOf(work: OlWork | CatalogBook): CatalogBook {
  return "openLibraryId" in work ? work : fromOlWork(work);
}

export class BookCatalogError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

export function hasPages<T extends { pages: number | null }>(work: T): work is T & { pages: number } {
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

/** "J. K. Rowling, Mary GrandPré" → "J. K. Rowling", so illustrators don't split a match. */
export function firstAuthor(name: string): string {
  const comma = name.indexOf(",");
  return (comma === -1 ? name : name.slice(0, comma)).trim();
}

export function authorsMatch(a: string, b: string): boolean {
  return authorUnknown(a) || authorUnknown(b) || normaliseAuthor(firstAuthor(a)) === normaliseAuthor(firstAuthor(b));
}

/**
 * Title keys for merging catalogue hits of the same novel: the full title, plus the part
 * before a colon so "Piranesi" and "Piranesi: A Novel" collapse. Library matching stays on
 * the full normalised title — "The Hobbit" is not the graphic novel of the same name.
 */
export function titleKeys(title: string): string[] {
  const full = normaliseTitle(title);
  if (!full) return [];
  const colon = title.indexOf(":");
  if (colon <= 0) return [full];
  const short = normaliseTitle(title.slice(0, colon));
  return short && short !== full ? [full, short] : [full];
}

export interface ExistingBook {
  id: string;
  title: string;
  author: string;
  openLibraryId: string | null;
  googleBooksId?: string | null;
  publisher: string | null;
  pages: number;
  coverImage: string | null;
  seriesId: string | null;
  seriesName: string | null;
}

/**
 * A book already in the library that this work is — by Open Library id, by Google Books id,
 * or else by title + author. A row linked to the *other* catalogue still matches (so importing
 * from Google Books does not duplicate one already linked to Open Library). A row already
 * linked to a *different* work at this source is left alone.
 */
export function matchExisting<T extends ExistingBook>(work: OlWork | CatalogBook, library: readonly T[]): T | null {
  const cat = catalogOf(work);
  if (cat.openLibraryId) {
    const linked = library.find((x) => x.openLibraryId === cat.openLibraryId);
    if (linked) return linked;
  }
  if (cat.googleBooksId) {
    const linked = library.find((x) => x.googleBooksId === cat.googleBooksId);
    if (linked) return linked;
  }
  const title = normaliseTitle(cat.title);
  return (
    library.find((x) => {
      if (cat.openLibraryId && x.openLibraryId && x.openLibraryId !== cat.openLibraryId) return false;
      if (cat.googleBooksId && x.googleBooksId && x.googleBooksId !== cat.googleBooksId) return false;
      if (normaliseTitle(x.title) !== title) return false;
      return authorsMatch(x.author, cat.author);
    }) ?? null
  );
}

export interface NewBook {
  title: string;
  author: string;
  pages: number;
  pagesRead: number;
  coverImage: string | null;
  publisher: string | null;
  openLibraryId: string | null;
  googleBooksId: string | null;
}

export interface BookUpdate {
  id: string;
  data: {
    openLibraryId?: string;
    googleBooksId?: string;
    author?: string;
    coverImage?: string;
    publisher?: string;
    /** Into the series being imported into: only ever from standalone. */
    seriesId?: string;
  };
}

export interface ReportLine {
  id: string;
  openLibraryId: string | null;
  googleBooksId: string | null;
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
 * Lands a batch of catalogue books in the library, in `seriesId` (or standalone, when null).
 *
 * A work is matched by Open Library id, Google Books id, or else — once — by title and author,
 * even when the existing row is already linked to the other catalogue. The merge only ever adds:
 *
 *  - Blanks get filled: a cover, an author of "Unknown", a publisher from Google Books, and
 *    whichever catalogue id is missing. Everything you set yourself — title, pages, pages read,
 *    rating, rereads, notes, language, a publisher or cover you chose — is never touched. Page
 *    counts vary by edition, so a stored one is never overwritten.
 *  - A standalone book moves into the series it is imported into. A book in a different series
 *    stays where it is and is reported — which series is your call, not an import's.
 */
export function planImport(
  existing: ExistingBook[],
  incoming: ((OlWork | CatalogBook) & { pages: number })[],
  seriesId: string | null,
  { read }: { read: boolean },
): ImportPlan {
  const plan: ImportPlan = { create: [], update: [], report: [] };
  const claimed = new Set<string>();
  const seen = new Set<string>();

  for (const work of incoming) {
    const cat = catalogOf(work);
    if (seen.has(cat.id)) continue;
    if (cat.openLibraryId && seen.has(cat.openLibraryId)) continue;
    if (cat.googleBooksId && seen.has(`gb:${cat.googleBooksId}`)) continue;
    seen.add(cat.id);
    if (cat.openLibraryId) seen.add(cat.openLibraryId);
    if (cat.googleBooksId) seen.add(`gb:${cat.googleBooksId}`);

    const current = matchExisting(cat, existing.filter((b) => !claimed.has(b.id)));
    if (!current) {
      plan.create.push({
        title: cat.title,
        author: cat.author,
        pages: work.pages,
        pagesRead: read ? work.pages : 0,
        coverImage: cat.cover,
        publisher: cat.publisher,
        openLibraryId: cat.openLibraryId,
        googleBooksId: cat.googleBooksId,
      });
      plan.report.push({
        id: cat.id,
        openLibraryId: cat.openLibraryId,
        googleBooksId: cat.googleBooksId,
        title: cat.title,
        year: cat.year,
        outcome: "added",
      });
      continue;
    }
    claimed.add(current.id);

    const data: BookUpdate["data"] = {};
    if (!current.openLibraryId && cat.openLibraryId) data.openLibraryId = cat.openLibraryId;
    if (!current.googleBooksId && cat.googleBooksId) data.googleBooksId = cat.googleBooksId;
    if (authorUnknown(current.author) && !authorUnknown(cat.author)) data.author = cat.author;
    if (!current.coverImage && cat.cover) data.coverImage = cat.cover;
    if (!current.publisher && cat.publisher) data.publisher = cat.publisher;

    const linkedASource =
      (!current.openLibraryId && !!cat.openLibraryId) || (!current.googleBooksId && !!cat.googleBooksId);

    let outcome: Outcome;
    let where: string | undefined;
    if (current.seriesId === seriesId) {
      outcome = linkedASource ? "linked" : "already";
    } else if (current.seriesId === null) {
      data.seriesId = seriesId!;
      outcome = "moved";
    } else {
      outcome = "elsewhere";
      where = current.seriesName ?? "another series";
    }

    if (Object.keys(data).length > 0) plan.update.push({ id: current.id, data });
    plan.report.push({
      id: cat.id,
      openLibraryId: cat.openLibraryId,
      googleBooksId: cat.googleBooksId,
      title: current.title,
      year: cat.year,
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
  publisher?: string | null;
}

/**
 * What a catalogue may change on a book already in the library — when linking a hand-added
 * one, or checking a linked one again. Only blanks are filled: your title, pages, progress,
 * rating, notes, language and publisher are never touched.
 */
export function updatesFromWork(existing: BookFields, work: OlWork | CatalogBook): Partial<BookFields> {
  const cat = catalogOf(work);
  const out: Partial<BookFields> = {};
  if (authorUnknown(existing.author) && !authorUnknown(cat.author)) out.author = cat.author;
  if (!existing.coverImage && cat.cover) out.coverImage = cat.cover;
  if (!existing.publisher && cat.publisher) out.publisher = cat.publisher;
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
