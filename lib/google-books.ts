// Google Books as the second book catalogue: reading a volume, covers from books.google.com,
// and merging its hits with Open Library's so a title one of them hasn't got still appears.
//
// Pure and dependency-free (scripts/test-google-books.mjs). The API client is
// lib/google-books-service.ts. Google Books is edition-centric — the same novel is many
// volumes — so search results are collapsed by title + author before they meet Open Library.

import {
  MAX_IMPORT, authorsMatch, authorsOf, firstAuthor, fromOlWork, isbnOf, normaliseAuthor,
  queryFit, titleKeys, workIdOf, yearOf,
  type CatalogBook, type OlWork,
} from "@/lib/openlibrary";

export const GB_IMAGE_HOSTS = ["books.google.com", "books.googleusercontent.com"] as const;

/** Google's attribution, shown wherever its data is used. */
export const GB_NOTICE = "This page uses the Google Books API.";

export const GB_NOTICE_HREF = "https://books.google.com";

export interface GbVolume {
  /** Opaque volume id, e.g. "_ojXNuzgHRcC". */
  id: string;
  title: string;
  author: string;
  year: number | null;
  pages: number | null;
  cover: string | null;
  coverThumb: string | null;
  publisher: string | null;
  /** ISO 639-1 from volumeInfo.language, e.g. "en". */
  language: string | null;
}

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const GB_ID = /^[A-Za-z0-9_-]{8,20}$/;

/**
 * A Google Books volume id, from a bare id, a books.google.com URL (`?id=`), or a
 * `/volumes/{id}` API URL. Open Library work ids and ISBNs are refused — they can look like
 * ids and must not be stitched into a Google URL.
 */
export function googleVolumeIdOf(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const fromUrl =
    raw.match(/[?&]id=([A-Za-z0-9_-]{8,20})/) ??
    raw.match(/\/volumes\/([A-Za-z0-9_-]{8,20})(?:[/?#]|$)/);
  const id = fromUrl ? fromUrl[1] : raw;
  if (workIdOf(id) || isbnOf(id)) return null;
  return GB_ID.test(id) ? id : null;
}

/**
 * What we ask Google Books: an ISBN, a pasted volume URL, or the words as typed. A bare
 * 12-character token is left as a title — many volume ids look like words, and looking each
 * one up as an id would 404 a real search.
 */
export function googleSearchQueryOf(query: string): { kind: "isbn" | "id" | "text"; value: string } {
  const isbn = isbnOf(query);
  if (isbn) return { kind: "isbn", value: isbn };
  if (/google\.com|googleapis\.com/i.test(query) || /[?&]id=/.test(query) || /\/volumes\//.test(query)) {
    const id = googleVolumeIdOf(query);
    if (id) return { kind: "id", value: id };
  }
  return { kind: "text", value: query.trim() };
}

/**
 * Cover at one of Google's zoom levels. zoom=1 is stored (card-sized); zoom=5 is the search
 * thumbnail. Built from the volume id rather than `imageLinks`, which are http and tiny.
 * Callers only pass a volume that *has* imageLinks, so we don't hotlink the generic placeholder.
 */
export function googleCoverUrl(volumeId: string, size: "thumb" | "full" = "full"): string {
  const zoom = size === "thumb" ? 5 : 1;
  return `https://books.google.com/books/content?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=${zoom}&source=gbs_api`;
}

export function isGoogleBooksImage(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const host = new URL(src).hostname;
    return (GB_IMAGE_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}

/** "2005", "2005-11" or "2005-11-15". */
export function yearFromDate(value: unknown): number | null {
  if (typeof value === "number") return yearOf(value);
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})/);
  return m ? yearOf(Number(m[1])) : null;
}

function hasImageLinks(info: Raw): boolean {
  const links = info.imageLinks;
  return !!links && typeof links === "object" && !Array.isArray(links) && Object.keys(links as object).length > 0;
}

/** A volumes.list / volumes.get document, or null if it's unusable (no id or no title). */
export function toVolume(raw: Raw | null | undefined): GbVolume | null {
  if (!raw) return null;
  const id = googleVolumeIdOf(raw.id);
  const info = (raw.volumeInfo && typeof raw.volumeInfo === "object" ? raw.volumeInfo : {}) as Raw;
  const title = text(info.title);
  if (!id || !title) return null;
  const pictured = hasImageLinks(info);
  const lang = text(info.language).toLowerCase();
  return {
    id,
    title,
    author: authorsOf(info.authors),
    year: yearFromDate(info.publishedDate),
    pages: positiveInt(info.pageCount),
    cover: pictured ? googleCoverUrl(id, "full") : null,
    coverThumb: pictured ? googleCoverUrl(id, "thumb") : null,
    publisher: text(info.publisher) || null,
    language: /^[a-z]{2,3}$/.test(lang) ? lang : null,
  };
}

export function fromGbVolume(volume: GbVolume): CatalogBook {
  return {
    id: `gb:${volume.id}`,
    title: volume.title,
    author: volume.author,
    year: volume.year,
    pages: volume.pages,
    cover: volume.cover,
    coverThumb: volume.coverThumb,
    publisher: volume.publisher,
    openLibraryId: null,
    googleBooksId: volume.id,
  };
}

function pickCloser(a: string, b: string, query: string, fallback: string): string {
  if (!query.trim()) return fallback;
  return queryFit(a, query) >= queryFit(b, query) ? a : b;
}

/** Open Library title/cover/year win unless Google Books is closer to what was searched. */
export function combineSources(ol: OlWork | null, gb: GbVolume | null, query = ""): CatalogBook | null {
  if (!ol && !gb) return null;
  if (ol && !gb) return fromOlWork(ol);
  if (!ol && gb) return fromGbVolume(gb);
  const work = ol!;
  const volume = gb!;
  const title = pickCloser(work.title, volume.title, query, work.title);
  const author = work.author !== "Unknown"
    ? pickCloser(work.author, volume.author, query, work.author)
    : volume.author;
  const preferGb = title === volume.title && title !== work.title;
  return {
    id: work.id,
    title,
    author,
    year: work.year ?? volume.year,
    pages: work.pages ?? volume.pages,
    cover: preferGb ? (volume.cover ?? work.cover) : (work.cover ?? volume.cover),
    coverThumb: preferGb ? (volume.coverThumb ?? work.coverThumb) : (work.coverThumb ?? volume.coverThumb),
    publisher: volume.publisher,
    openLibraryId: work.id,
    googleBooksId: volume.id,
  };
}

function volumeIdentity(volume: GbVolume): string {
  const title = titleKeys(volume.title)[0] ?? "";
  const author = volume.author === "Unknown" ? "" : normaliseAuthor(firstAuthor(volume.author));
  return `${title}\0${author}`;
}

/**
 * Same novel across catalogues: any title key overlaps (so a subtitle doesn't split it) and
 * the authors match. Used only to merge search hits — library rows still match on the full title.
 */
export function sameWork(a: { title: string; author: string }, b: { title: string; author: string }): boolean {
  const titles = new Set(titleKeys(a.title));
  if (!titleKeys(b.title).some((t) => titles.has(t))) return false;
  return authorsMatch(a.author, b.author);
}

function betterVolume(prev: GbVolume, next: GbVolume, query: string): GbVolume {
  if (query.trim()) {
    const delta = queryFit(next.title, query) - queryFit(prev.title, query);
    if (delta > 0) return next;
    if (delta < 0) return prev;
  }
  if (!prev.pages && next.pages) return next;
  if (prev.pages && !next.pages) return prev;
  if (!prev.cover && next.cover) return next;
  return prev;
}

/** Collapse Google Books' edition soup: one volume per title + author, keeping pages then a cover. */
export function dedupeVolumes(volumes: GbVolume[], query = ""): GbVolume[] {
  const best = new Map<string, GbVolume>();
  const order: string[] = [];
  for (const volume of volumes) {
    const key = volumeIdentity(volume);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, volume);
      order.push(key);
      continue;
    }
    best.set(key, betterVolume(prev, volume, query));
  }
  return order.map((key) => best.get(key)!);
}

/**
 * One list for Add Book: Open Library's order (a series search lists its books), with Google
 * Books ids attached when the same novel is there, then Google-only titles Open Library missed.
 * Hits whose title is in the same script as the query (English search → English title, not
 * 無職転生) are listed first. Capped at MAX_IMPORT.
 */
export function mergeCatalog(olWorks: OlWork[], gbVolumes: GbVolume[], query = ""): CatalogBook[] {
  const gbUnique = dedupeVolumes(gbVolumes, query);
  const used = new Set<string>();
  const merged: CatalogBook[] = [];
  for (const work of olWorks) {
    const gb = gbUnique.find((v) => !used.has(v.id) && sameWork(work, v));
    if (gb) used.add(gb.id);
    merged.push(combineSources(work, gb ?? null, query)!);
  }
  for (const volume of gbUnique) {
    if (used.has(volume.id)) continue;
    merged.push(fromGbVolume(volume));
  }
  const seen = new Set<string>();
  const ranked = merged
    .map((book, i) => ({ book, i, score: queryFit(book.title, query) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const out: CatalogBook[] = [];
  for (const { book } of ranked) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    out.push(book);
    if (out.length >= MAX_IMPORT) break;
  }
  return out;
}
