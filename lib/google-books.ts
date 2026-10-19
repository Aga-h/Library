// Google Books is the book catalogue: reading a volume and covers from books.google.com.
//
// Pure and dependency-free (scripts/test-google-books.mjs). The API client is
// lib/google-books-service.ts. Google Books is edition-centric — the same novel is many
// volumes — so search results are collapsed by title + author.

import {
  MAX_IMPORT, authorsMatch, authorsOf, hasPages, isbnOf,
  queryFit, titleKeys, workIdOf, yearOf,
  type CatalogBook,
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
  /** saleInfo.isEbook — Kindle/e-pub listings use a different page count than the print book. */
  ebook: boolean;
  /** volumeInfo.dimensions — a physical copy, not the Kindle file. */
  printEdition: boolean;
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

/** Google often stores "Mistborn" as the title and "The Final Empire" as the subtitle. */
function volumeTitle(info: Raw): string {
  const title = text(info.title);
  const subtitle = text(info.subtitle);
  if (!title) return "";
  if (!subtitle || title.toLowerCase().includes(subtitle.toLowerCase())) return title;
  return `${title}: ${subtitle}`;
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
  const title = volumeTitle(info);
  if (!id || !title) return null;
  const pictured = hasImageLinks(info);
  const lang = text(info.language).toLowerCase();
  const sale = (raw.saleInfo && typeof raw.saleInfo === "object" && !Array.isArray(raw.saleInfo)
    ? raw.saleInfo
    : {}) as Raw;
  const kindle = /\bkindle\b/i.test(`${title} ${text(info.subtitle)}`);
  const dims = info.dimensions;
  const printEdition = !!dims && typeof dims === "object" && !Array.isArray(dims)
    && ["height", "width", "thickness"].some((side) => text((dims as Raw)[side]));
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
    ebook: sale.isEbook === true || kindle,
    printEdition,
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

/**
 * Same novel for collapsing search hits: authors match, and either the full titles match or
 * one is the other with only a subtitle ("Piranesi" / "Piranesi: A Novel"). The short key
 * before a colon is not enough on its own — that would merge every Mushoku Tensei volume.
 * Library rows still match on the full title.
 */
export function sameWork(a: { title: string; author: string }, b: { title: string; author: string }): boolean {
  if (!authorsMatch(a.author, b.author)) return false;
  const aKeys = titleKeys(a.title);
  const bKeys = titleKeys(b.title);
  const aFull = aKeys[0];
  const bFull = bKeys[0];
  if (!aFull || !bFull) return false;
  if (aFull === bFull) return true;
  if (aKeys[1] && aKeys[1] === bFull) return true;
  if (bKeys[1] && bKeys[1] === aFull) return true;
  return false;
}

/** Blank rows from one search (two pages of results) that still need volumes.get. */
export const REFILL_LIMIT = 80;

/**
 * Search (`volumes.list`) reports 0 pages for a paperback that has no preview. The count on
 * Google's own page comes back from `volumes.get`. Every blank row is looked up — a series
 * search is many paperbacks, not only the closest title. Ones sitting next to a Kindle
 * listing go first.
 */
export function volumesToRefetch(volumes: GbVolume[], query: string, limit = REFILL_LIMIT): string[] {
  const ranked = volumes
    .filter((volume) => volume.pages === null)
    .map((volume, i) => ({
      id: volume.id,
      i,
      score: queryFit(volume.title, query),
      sibling: volumes.some((other) => other.id !== volume.id && other.pages !== null && sameWork(other, volume)),
    }))
    .sort((a, b) => Number(b.sibling) - Number(a.sibling) || b.score - a.score || a.i - b.i);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    ids.push(row.id);
    if (ids.length >= limit) break;
  }
  return ids;
}

/**
 * Shown in search. English, a missing tag, or "un"/"und" (undetermined — Google uses that
 * for a lot of English books, and langRestrict=en drops them). A tagged translation is not.
 */
export function isEnglishListing(volume: { language: string | null }): boolean {
  return volume.language === null || volume.language === "en" || volume.language === "eng"
    || volume.language === "un" || volume.language === "und";
}

function betterVolume(prev: GbVolume, next: GbVolume, query: string): GbVolume {
  // Same novel: English paperback, not a translation with a longer page count
  // ("Mistborn: O Império Final") and not the Kindle file.
  const nextEnglish = next.language === "en" || next.language === "eng";
  const prevEnglish = prev.language === "en" || prev.language === "eng";
  if (nextEnglish !== prevEnglish) {
    if (nextEnglish && next.pages) return next;
    if (prevEnglish && prev.pages) return prev;
  }
  if (prev.printEdition !== next.printEdition) {
    if (next.printEdition && next.pages) return next;
    if (prev.printEdition && prev.pages) return prev;
  }
  if (prev.ebook && !next.ebook && next.pages) return next;
  if (!prev.ebook && next.ebook && prev.pages) return prev;
  if (prev.pages && next.pages && next.pages !== prev.pages) {
    return next.pages > prev.pages ? next : prev;
  }
  if (!prev.pages && next.pages) return next;
  if (prev.pages && !next.pages) return prev;
  if (query.trim()) {
    const delta = queryFit(next.title, query) - queryFit(prev.title, query);
    if (delta > 0) return next;
    if (delta < 0) return prev;
  }
  if (!prev.cover && next.cover) return next;
  return prev;
}

/** Collapse Google Books' edition soup: one volume per novel, preferring print page counts. */
export function dedupeVolumes(volumes: GbVolume[], query = ""): GbVolume[] {
  const best: GbVolume[] = [];
  for (const volume of volumes) {
    const idx = best.findIndex((prev) => sameWork(prev, volume));
    if (idx === -1) {
      best.push(volume);
      continue;
    }
    best[idx] = betterVolume(best[idx], volume, query);
  }
  return best;
}

/**
 * Add Book's list: English editions only (a Portuguese or Spanish translation is left out),
 * collapsed to one row per novel, titles that fit the query first. Volumes with no page count
 * are omitted — they cannot be imported. Capped at MAX_IMPORT.
 */
export function catalogFromVolumes(
  volumes: GbVolume[],
  query = "",
): Array<CatalogBook & { pages: number }> {
  const unique = dedupeVolumes(volumes.filter(isEnglishListing), query);
  const seen = new Set<string>();
  const ranked = unique
    .map(fromGbVolume)
    .filter(hasPages)
    .map((book, i) => ({ book, i, score: queryFit(book.title, query) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const out: Array<CatalogBook & { pages: number }> = [];
  for (const { book } of ranked) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    out.push(book);
    if (out.length >= MAX_IMPORT) break;
  }
  return out;
}
