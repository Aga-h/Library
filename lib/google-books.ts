// Google Books is the book catalogue: reading a volume and covers from books.google.com.
//
// Pure and dependency-free (scripts/test-google-books.mjs). The API client is
// lib/google-books-service.ts. Google Books is edition-centric — the same novel is many
// volumes — so search results are grouped into books (groupEditions).

import {
  MAX_IMPORT, authorsMatch, authorsOf, dominantScript, firstAuthor, hasPages, isbnOf, normaliseAuthor,
  queryFit, workIdOf, yearOf,
  type CatalogBook,
} from "@/lib/openlibrary";
import { normaliseTitle } from "@/lib/tmdb";

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
  /** ISBN-13 (else ISBN-10): two listings with the same one are the same edition. */
  isbn: string | null;
  /** volumeInfo.seriesInfo.bookDisplayNumber — where Google says the book sits in its series. */
  seriesNumber: number | null;
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
export function googleCoverUrl(volumeId: string, size: "thumb" | "full" | "large" = "full"): string {
  // zoom=5 is ~80px wide, zoom=1 128px (stored), zoom=2 300px (the edition picker, sharp on retina).
  const zoom = size === "thumb" ? 5 : size === "large" ? 2 : 1;
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
  const ids = Array.isArray(info.industryIdentifiers) ? (info.industryIdentifiers as Raw[]) : [];
  const isbnOfType = (type: string) => text(ids.find((x) => x && x.type === type)?.identifier).replace(/[^0-9X]/gi, "");
  const series = (info.seriesInfo && typeof info.seriesInfo === "object" ? info.seriesInfo : {}) as Raw;
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
    isbn: isbnOfType("ISBN_13") || isbnOfType("ISBN_10") || null,
    seriesNumber: positiveInt(series.bookDisplayNumber),
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

type Titled = { title: string; author: string };

// ── Which listings are one book ──────────────────────────────────────────────
// Google Books lists editions, not books, each titled the way its publisher did: "Mistborn: The
// Final Empire", "The Final Empire", "The Final Empire: Mistborn Book One", "Mistborn: Collector's
// Tenth Anniversary Limited Edition". A title is read as segments (split at colons, brackets and
// spaced dashes). Edition dressing and series positions are set aside, series names are dropped,
// and what is left names the book.

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};
const NUM = "(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third|fourth|fifth)";
/** "Mistborn Book One", "Vol. 2", "Book 3" — the place in a series, at the end of a segment. */
const POSITION_AT_END = new RegExp(`^(?:(.*?)\\s+)?(?:book|bk|volume|vol|part|no|number)\\s+${NUM}$`);
/** "Book One of the Mistborn Trilogy". */
const POSITION_OF = new RegExp(`^(?:book|bk|volume|vol|part)\\s+${NUM}\\s+(?:of|in)\\s+(?:the\\s+)?(.+)$`);
/** A subtitle that only says which printing this is. */
const EDITION_WORDS = /\b(editions?|anniversary|illustrated|deluxe|collectors?|limited|special|revised|reprint|reissue|unabridged|abridged|annotated|hardcover|hardback|paperback|mass market|kindle|ebook|large print|tie in|signed|exclusive)\b/;
/** "A Novel", "A Mistborn Novel". */
const GENRE_TAG = /^(?:an?\s+(?:\S+\s+){0,3})?(?:novel|novella|memoir|thriller|mystery|romance|story|tale|saga)$/;
/** A different telling of the same story — the light novel is not the manga. */
const FORMAT_WORDS = /\b(light novel|manga|graphic novel|comics?|audiobook|study guide|summary|workbook|companion|colou?ring book)\b/;
/** Several books in one: never an edition of one of them. */
const OMNIBUS = /\b(trilogy|box(?:ed)? set|boxset|omnibus|collection|bundle|complete series|books \d+ \d+)\b/;
const SERIES_WORD = /\s+(?:trilogy|series|saga|cycle|sequence|chronicles)$/;

export interface ParsedTitle {
  /** The segments that name the book, normalised: ["mistborn", "the final empire"]. */
  core: string[];
  /** Its place in a series, from the title ("Book One", "Vol. 2", "#3"). */
  number: number | null;
  /** The series a position names: "mistborn" in "The Final Empire: Mistborn Book One". */
  series: string | null;
  omnibus: boolean;
}

function numberOf(word: string): number | null {
  const n = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word] ?? 0;
  return n > 0 ? n : null;
}

export function parseTitle(title: string): ParsedTitle {
  const parsed: ParsedTitle = { core: [], number: null, series: null, omnibus: false };
  title.split(/\s*[:;()[\]]\s*|\s+[-–—]\s+/).forEach((part, i) => {
    const hash = part.match(/^(.*?)\s*#\s*(\d{1,3})\s*$/);
    if (hash) parsed.number ??= numberOf(hash[2]);
    let segment = normaliseTitle(hash ? hash[1] : part);
    if (!segment) return;
    const of = segment.match(POSITION_OF);
    if (of) {
      parsed.number ??= numberOf(of[1]);
      parsed.series ??= of[2].replace(SERIES_WORD, "");
      return;
    }
    const at = segment.match(POSITION_AT_END);
    if (at) {
      parsed.number ??= numberOf(at[2]);
      segment = (at[1] ?? "").replace(SERIES_WORD, "").trim();
      if (!segment) return;
      parsed.series ??= segment;
    } else if (i > 0 && (EDITION_WORDS.test(segment) || GENRE_TAG.test(segment))) {
      // Only a subtitle is dressing: a main title like "Special Topics in Calamity Physics" stays.
      return;
    }
    if (OMNIBUS.test(segment)) parsed.omnibus = true;
    parsed.core.push(segment);
  });
  return parsed;
}

interface Listing<T extends Titled> {
  row: T;
  author: string;
  parsed: ParsedTitle;
  /** The core without series names: what tells this book from the others in its series. */
  words: Set<string>;
  /** Google's own series number, when it gives one. */
  googleNumber: number | null;
}

const setKey = (words: Set<string>) => [...words].sort().join("|");
const authorKey = (author: string) => normaliseAuthor(firstAuthor(author));

function listingsOf<T extends Titled & { seriesNumber?: number | null }>(rows: readonly T[]): Listing<T>[] {
  const parsed = rows.map((row) => ({ row, author: authorKey(row.author), parsed: parseTitle(row.title) }));
  // Series names, per author: a first segment that heads two different books ("Mistborn: The Final
  // Empire", "Mistborn: The Well of Ascension"), or one a position names that also heads a title.
  const rests = new Map<string, Set<string>>();
  const heads = new Set<string>();
  for (const { author, parsed: p } of parsed) {
    if (!p.core[0]) continue;
    heads.add(`${author}|${p.core[0]}`);
    if (p.core.length < 2) continue;
    const key = `${author}|${p.core[0]}`;
    const set = rests.get(key) ?? new Set<string>();
    set.add(p.core.slice(1).join("|"));
    rests.set(key, set);
  }
  const series = new Set([...rests].filter(([, set]) => set.size > 1).map(([key]) => key));
  for (const { author, parsed: p } of parsed) {
    if (p.series && heads.has(`${author}|${p.series}`)) series.add(`${author}|${p.series}`);
  }
  return parsed.map(({ row, author, parsed: p }) => ({
    row,
    author,
    parsed: p,
    words: new Set(p.core.filter((segment) => !series.has(`${author}|${segment}`))),
    googleNumber: row.seriesNumber ?? null,
  }));
}

/**
 * Two smaller titles inside one larger: "Piranesi" in "Piranesi: A Novel" is the same book, but
 * "Mistborn" sits inside both "Mistborn: The Final Empire" and "Mistborn: The Well of Ascension".
 */
function ambiguousCores<T extends Titled>(listings: Listing<T>[]): Set<string> {
  const supersets = new Map<string, Set<string>>();
  for (const a of listings) {
    if (!a.words.size) continue;
    for (const b of listings) {
      if (b.words.size <= a.words.size || a.author !== b.author) continue;
      if (![...a.words].every((w) => b.words.has(w))) continue;
      const key = `${a.author}|${setKey(a.words)}`;
      const set = supersets.get(key) ?? new Set<string>();
      set.add(setKey(b.words));
      supersets.set(key, set);
    }
  }
  return new Set([...supersets].filter(([, set]) => set.size > 1).map(([key]) => key));
}

function sameBook<T extends Titled>(a: Listing<T>, b: Listing<T>, ambiguous: Set<string>): boolean {
  if (!authorsMatch(a.row.author, b.row.author)) return false;
  if (a.parsed.omnibus || b.parsed.omnibus) {
    return a.parsed.omnibus && b.parsed.omnibus && setKey(a.words) === setKey(b.words);
  }
  if (a.parsed.number && b.parsed.number && a.parsed.number !== b.parsed.number) return false;
  if (!a.words.size || !b.words.size) return false;
  if (setKey(a.words) === setKey(b.words)) return true;
  const [small, big] = a.words.size < b.words.size ? [a, b] : [b, a];
  if (![...small.words].every((w) => big.words.has(w))) return false;
  if ([...big.words].some((w) => !small.words.has(w) && FORMAT_WORDS.test(w))) return false;
  return !ambiguous.has(`${small.author}|${setKey(small.words)}`);
}

/**
 * The listings grouped by book, in the order each book first appears. A bare series name
 * ("Mistborn", or "Mistborn: Collector's Tenth Anniversary Limited Edition") joins the series'
 * book of that number — the first, when it gives none — once another listing says which book
 * that is ("The Final Empire: Mistborn Book One", or Google's series number). Otherwise it is a
 * book of its own.
 */
export function groupEditions<T extends Titled & { seriesNumber?: number | null }>(rows: readonly T[]): T[][] {
  const listings = listingsOf(rows);
  const ambiguous = ambiguousCores(listings);
  const parent = listings.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number) => {
    const [a, b] = [find(i), find(j)].sort((x, y) => x - y);
    parent[b] = a;
  };
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      if (sameBook(listings[i], listings[j], ambiguous)) join(i, j);
    }
  }

  // Which book is which number in a series: "mistborn|1" → the group holding The Final Empire.
  const numbered = new Map<string, Set<number>>();
  listings.forEach((l, i) => {
    if (!l.words.size || l.parsed.omnibus) return;
    const n = l.parsed.number ?? l.googleNumber;
    const name = l.parsed.series ?? (l.parsed.core[0] && !l.words.has(l.parsed.core[0]) ? l.parsed.core[0] : null);
    if (!n || !name) return;
    const key = `${l.author}|${name}|${n}`;
    const set = numbered.get(key) ?? new Set<number>();
    set.add(find(i));
    numbered.set(key, set);
  });
  listings.forEach((l, i) => {
    if (l.words.size || l.parsed.omnibus || !l.parsed.core[0]) return;
    const n = l.parsed.number ?? l.googleNumber ?? 1;
    const groups = numbered.get(`${l.author}|${l.parsed.core[0]}|${n}`);
    if (groups?.size === 1) join(i, [...groups][0]);
  });
  // Bare listings left over: the same series name and number is one book.
  listings.forEach((a, i) => {
    if (a.words.size || a.parsed.omnibus || find(i) !== i) return;
    listings.forEach((b, j) => {
      if (j <= i || b.words.size || b.parsed.omnibus || find(j) !== j) return;
      if (a.author === b.author && a.parsed.core[0] === b.parsed.core[0]
        && (a.parsed.number ?? 1) === (b.parsed.number ?? 1)) join(i, j);
    });
  });

  const groups = new Map<number, T[]>();
  listings.forEach((l, i) => {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(l.row);
    groups.set(root, group);
  });
  return [...groups.values()];
}

/**
 * Two titles are one book by the rules above, with nothing else in the list to go on. Search and
 * the edition picker use groupEditions, which also sees the rest of the list.
 */
export function sameWork(a: Titled, b: Titled): boolean {
  return groupEditions([a, b]).length === 1;
}

/** Blank rows from one search (two pages of results) that still need volumes.get. */
export const REFILL_LIMIT = 80;

/**
 * Search (`volumes.list`) reports 0 pages for a paperback that has no preview. The count on
 * Google's own page comes back from `volumes.get`. Every blank row is looked up — a series
 * search is many paperbacks, not only the closest title. Ones whose book has another listing
 * with a count (a Kindle beside the paperback) go first.
 */
export function volumesToRefetch(volumes: GbVolume[], query: string, limit = REFILL_LIMIT): string[] {
  const groupOf = new Map<string, GbVolume[]>();
  for (const group of groupEditions(volumes)) for (const volume of group) groupOf.set(volume.id, group);
  const ranked = volumes
    .filter((volume) => volume.pages === null)
    .map((volume, i) => ({
      id: volume.id,
      i,
      score: queryFit(volume.title, query),
      sibling: (groupOf.get(volume.id) ?? []).some((other) => other.id !== volume.id && other.pages !== null),
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

/** Function words that mark a title as another language: "Mistborn: El imperio final". */
const FOREIGN_WORDS = /(?:^|\s)(el|la|los|las|del|una|le|les|des|du|der|das|und|ein|eine|il|gli|della|di|os|um|uma|dos|het|een|och|og|ve|bir|ile)(?:\s|$)/;

/**
 * Shown in search and the edition picker: English only. Tagged English, or — since Google tags a
 * lot of English books "un"/"und" (undetermined) or not at all, and langRestrict=en drops them —
 * untagged with a title in English. A tagged translation never is.
 */
export function isEnglishListing(volume: { language: string | null; title?: string }): boolean {
  if (volume.language === "en" || volume.language === "eng") return true;
  if (volume.language !== null && volume.language !== "un" && volume.language !== "und") return false;
  const title = normaliseTitle(volume.title ?? "");
  return dominantScript(title) === "latin" && !FOREIGN_WORDS.test(title);
}

/** Of two listings of one edition, the one worth keeping: a page count, then a cover. */
function betterListing(prev: GbVolume, next: GbVolume): GbVolume {
  if (!prev.pages && next.pages) return next;
  if (!prev.cover && next.cover && (next.pages || !prev.pages)) return next;
  return prev;
}

/**
 * The same edition listed twice: the same ISBN, or — where Google gives none — the same
 * page count, format, year and publisher. Different printings are different editions, even at
 * the same page count: the 2007 and 2014 Tor paperbacks are both 672 pages.
 */
function sameListing(a: GbVolume, b: GbVolume): boolean {
  if (a.isbn && b.isbn) return a.isbn === b.isbn;
  return a.pages === b.pages && a.ebook === b.ebook && a.year === b.year
    && normaliseAuthor(a.publisher ?? "") === normaliseAuthor(b.publisher ?? "");
}

function withoutDuplicates(volumes: GbVolume[]): GbVolume[] {
  const kept: GbVolume[] = [];
  for (const volume of volumes) {
    const i = kept.findIndex((prev) => sameListing(prev, volume));
    if (i === -1) kept.push(volume);
    else kept[i] = betterListing(kept[i], volume);
  }
  return kept;
}

/** Drop duplicate listings of one edition, book by book. Every other edition is kept. */
export function dedupeVolumes(volumes: GbVolume[]): GbVolume[] {
  const kept = new Set(groupEditions(volumes).flatMap(withoutDuplicates));
  return volumes.filter((volume) => kept.has(volume));
}

/** One Google Books edition of a novel: its own page count, cover and volume id. */
export interface CatalogEdition {
  googleBooksId: string;
  /** null where the search left it out; the picker asks volumes.get once the edition is centred. */
  pages: number | null;
  year: number | null;
  publisher: string | null;
  cover: string | null;
  coverThumb: string | null;
  /** A 300px cover for the edition picker, where the 128px one blurs on a retina screen. */
  coverLarge: string | null;
  ebook: boolean;
}

export function editionOf(volume: GbVolume): CatalogEdition {
  return {
    googleBooksId: volume.id,
    pages: volume.pages,
    year: volume.year,
    publisher: volume.publisher,
    cover: volume.cover,
    coverThumb: volume.coverThumb,
    coverLarge: volume.cover ? googleCoverUrl(volume.id, "large") : null,
    ebook: volume.ebook,
  };
}

/** The row shows an edition with a cover, a physical copy first, then anything not a Kindle file. */
function faceOrder(a: GbVolume, b: GbVolume): number {
  return Number(!!b.cover) - Number(!!a.cover)
    || Number(b.printEdition) - Number(a.printEdition)
    || Number(a.ebook) - Number(b.ebook);
}

/** The picker lists print editions, oldest first, then the eBooks, oldest first. */
function editionOrder(a: GbVolume, b: GbVolume): number {
  return Number(a.ebook) - Number(b.ebook) || (a.year ?? 9999) - (b.year ?? 9999);
}

/** The title a book's row goes by: one that names it, not a bare series or an edition's dressing. */
function bookTitle(group: GbVolume[], query: string): string {
  const named = group.filter((v) => parseTitle(v.title).core.length > 1 || group.length === 1);
  const pool = named.length ? named : group;
  const count = (title: string) => pool.filter((v) => v.title === title).length;
  const score = (v: GbVolume) => {
    const dressed = parseTitle(v.title).core.length < v.title.split(/\s*[:;()[\]]\s*|\s+[-–—]\s+/).filter(Boolean).length;
    return queryFit(v.title, query) - (dressed ? 30 : 0) + 5 * count(v.title);
  };
  return pool.reduce((best, v) => (score(v) > score(best) ? v : best)).title;
}

/**
 * Add Book's list: one row per book. Every edition of it in the results that has a cover rides
 * along on `editions` for the cover flow — print, then eBook — rather than being an extra row,
 * including ones whose page count the search left out. The row shows a physical copy with a page
 * count; a book with none is omitted. Capped at MAX_IMPORT.
 */
export function catalogFromVolumes(
  volumes: GbVolume[],
  query = "",
): Array<CatalogBook & { pages: number; editions: CatalogEdition[] }> {
  const ranked = groupEditions(volumes.filter(isEnglishListing))
    .map((group) => {
      const listed = withoutDuplicates(group);
      const face = listed.filter(hasPages).sort(faceOrder)[0];
      if (!face) return null;
      const rest = listed.filter((v) => v !== face && v.cover).sort(editionOrder);
      const book = {
        ...fromGbVolume(face),
        id: `gb:${face.id}`,
        title: bookTitle(group, query),
        pages: face.pages,
        editions: [face, ...rest].map(editionOf),
      };
      return { book, score: queryFit(book.title, query) };
    })
    .filter((row) => row !== null)
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: Array<CatalogBook & { pages: number; editions: CatalogEdition[] }> = [];
  for (const { book } of ranked) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    out.push(book);
    if (out.length >= MAX_IMPORT) break;
  }
  return out;
}

/**
 * What to ask Google Books for every edition of one book, by its first author: the title as
 * shown, and — for "Mistborn: The Final Empire" — each half on its own, since one publisher calls
 * it "The Final Empire" and another just "Mistborn". Punctuation goes, so "Mistborn:" can't read
 * as a search keyword.
 */
export function editionSearchQueries(book: Titled): string[] {
  const author = firstAuthor(book.author).replace(/"/g, "").trim();
  const by = author && normaliseAuthor(author) !== "unknown" ? ` inauthor:"${author}"` : "";
  const words = (title: string) => title.replace(/[^\p{L}\p{N}'’]+/gu, " ").trim();
  const { core } = parseTitle(book.title);
  const queries = [`${words(book.title)}${by}`];
  if (by && core.length > 1) queries.push(`${core.slice(1).join(" ")}${by}`, `${core[0]}${by}`);
  return [...new Set(queries)];
}

function groupHolding(volumes: GbVolume[], id: string): GbVolume[] {
  return groupEditions(volumes.filter(isEnglishListing)).find((group) => group.some((v) => v.id === id)) ?? [];
}

/**
 * The editions of one book — the one listing `bookId` is part of — among an edition search's
 * volumes: English listings with a cover, print oldest first, then eBooks. A page count the
 * search left out stays null for the picker to fetch. Other books the search also returned are
 * left out.
 */
export function editionsFromVolumes(volumes: GbVolume[], bookId: string): CatalogEdition[] {
  return withoutDuplicates(groupHolding(volumes, bookId))
    .filter((volume) => volume.cover)
    .sort(editionOrder)
    .map(editionOf);
}
