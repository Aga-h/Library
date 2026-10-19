// Talking to Google Books. Server-only: it reads GOOGLE_BOOKS_API_KEY, which must never reach
// a browser. Pure rules live in lib/google-books.ts.
//
// Only documented endpoints: GET /books/v1/volumes (search) and GET /books/v1/volumes/{id}.
// The key is optional until Google's anonymous quota dies; Add Book has no other catalogue,
// so a 403/429 without a key is an error, not a partial list.
// Overridable GOOGLE_BOOKS_BASE_URL so the importer can be tested against a local stand-in;
// production never sets it.

import { BookCatalogError, MAX_IMPORT, isbn13Of, isbnOf } from "@/lib/openlibrary";
import {
  editionSearchQueries, googleSearchQueryOf, googleVolumeIdOf, groupEditions, toVolume, volumesToRefetch,
  type GbVolume,
} from "@/lib/google-books";
import { bookByIsbn } from "@/lib/openlibrary-service";

function baseUrl(): string {
  return (process.env.GOOGLE_BOOKS_BASE_URL ?? "https://www.googleapis.com/books/v1").replace(/\/$/, "");
}

export class GoogleBooksError extends BookCatalogError {}

type Raw = Record<string, unknown>;

function apiKey(): string | null {
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  return key || null;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pauses before asking again. Since early October 2026 Google Books answers many searches with a
 * quick 503 "Service temporarily unavailable"; the same request usually succeeds a moment later.
 */
const RETRY_PAUSES = [300, 700, 1500, 3000];
const PASSING = new Set([500, 502, 503, 504]);

async function get(path: string, params: Record<string, string> = {}): Promise<Raw> {
  const url = new URL(`${baseUrl()}${path}`);
  const search = new URLSearchParams(params);
  // Google answers a server it can't place on the map with a 403 ("Cannot determine user
  // location"). Saying where we are makes every server get the same, US, results.
  search.set("country", "US");
  const key = apiKey();
  if (key) search.set("key", key);
  url.search = search.toString();

  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      res = null;
    }
    // A 429 is asked once more; a brief outage, up to RETRY_PAUSES times.
    const again = res === null || PASSING.has(res.status) ? attempt < RETRY_PAUSES.length
      : res.status === 429 ? attempt === 0 : false;
    if (!again) break;
    await pause(RETRY_PAUSES[attempt]);
  }
  if (!res) throw new GoogleBooksError("Couldn't reach Google Books — try again in a minute.", 502);

  if (res.status === 404) throw new GoogleBooksError("That isn't on Google Books.", 404);
  if (res.status === 429) {
    throw new GoogleBooksError(
      apiKey()
        ? "Google Books is rate-limiting requests — wait a moment and try again."
        : "Google Books needs GOOGLE_BOOKS_API_KEY — set it in Vercel, enable the Books API, and redeploy.",
      429,
    );
  }
  if (res.status === 403) {
    throw new GoogleBooksError(
      apiKey()
        ? "Google Books refused the API key — enable the Books API and check GOOGLE_BOOKS_API_KEY."
        : "Google Books needs GOOGLE_BOOKS_API_KEY — set it in Vercel, enable the Books API, and redeploy.",
      403,
    );
  }
  const body = (await res.json().catch(() => null)) as Raw | null;
  if (!res.ok || !body) throw new GoogleBooksError(`Google Books answered ${res.status}.`, 502);
  return body;
}

function volumesOf(body: Raw): GbVolume[] {
  const rows = Array.isArray(body.items) ? (body.items as Raw[]) : [];
  const volumes: GbVolume[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const volume = toVolume(row);
    if (!volume || seen.has(volume.id)) continue;
    seen.add(volume.id);
    volumes.push(volume);
  }
  return volumes;
}

/** Volumes matching a search, in Google's relevance order. Magazines excluded. */
export async function searchVolumes(query: string): Promise<GbVolume[]> {
  const asked = googleSearchQueryOf(query);
  if (asked.kind === "id") {
    try {
      return [await volumeById(asked.value)];
    } catch (e) {
      if (e instanceof GoogleBooksError && e.status === 404) return [];
      throw e;
    }
  }
  const q = asked.kind === "isbn" ? `isbn:${asked.value}` : asked.value;
  if (!q) return [];
  const params: Record<string, string> = {
    q,
    maxResults: String(MAX_IMPORT),
    printType: "books",
    projection: "full",
  };
  // Do not send langRestrict. Google's "en" filter drops books it tagged "un" and can return
  // an empty list for an English novel. Translations are removed afterwards in catalogFromVolumes.
  const first = await get("/volumes", params);
  const rows = Array.isArray(first.items) ? [...(first.items as Raw[])] : [];
  // A second page so a paperback buried under Kindle listings can still be collapsed in. Not
  // gated on totalItems: Google says 1 while sending 20. It sends at most 20 per page.
  if (rows.length > 0) {
    const second = await get("/volumes", { ...params, startIndex: String(rows.length) });
    if (Array.isArray(second.items)) rows.push(...(second.items as Raw[]));
  }
  const volumes = volumesOf({ items: rows });
  if (asked.kind === "isbn" && volumes.length === 0) return volumesForIsbn(asked.value);
  return refillBlankPages(volumes, volumesToRefetch(volumes, asked.value));
}

/**
 * Google Books answers every `isbn:` search with nothing since about 1 Oct 2026 (plain words
 * still work). Open Library says which book the ISBN is, that book is searched on Google the way
 * the edition picker does, and the listing with the ISBN is the answer — else, if Google has no
 * listing with it, the book's other listings, so it can still be found.
 */
async function volumesForIsbn(isbn: string): Promise<GbVolume[]> {
  const book = await bookByIsbn(isbn);
  if (!book) return [];
  const volumes = await bookVolumes(book);
  const wanted = isbn13Of(isbn);
  const exact = volumes.find((volume) => {
    const theirs = volume.isbn ? isbnOf(volume.isbn) : null;
    return theirs !== null && isbn13Of(theirs) === wanted;
  });
  // Grouped with everything found, so a bundle that names the book ("The Final Empire - The Well
  // of Ascension - …") is known for one and isn't taken for an edition of it.
  const group = groupEditions<{ title: string; author: string }>([book, ...volumes]).find((g) => g.includes(book)) ?? [];
  const found = exact ? [exact] : (group.filter((row) => row !== book) as GbVolume[]);
  return refillBlankPages(found, volumesToRefetch(found, book.title));
}

/**
 * Listings of one book, asked for under each title publishers give it (editionSearchQueries),
 * one page each (Google sends at most 20). A query Google keeps failing is left out; all of them
 * failing is an error.
 */
async function bookVolumes(book: { title: string; author: string }): Promise<GbVolume[]> {
  const params = { maxResults: String(MAX_IMPORT), printType: "books", projection: "full" };
  const settled = await Promise.allSettled(editionSearchQueries(book).map((q) => get("/volumes", { ...params, q })));
  const bodies = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (bodies.length === 0) throw (settled[0] as PromiseRejectedResult).reason;
  return volumesOf({ items: bodies.flatMap((body) => (Array.isArray(body.items) ? body.items : [])) });
}

/**
 * Listings of one book for the edition picker, `bookId` among them. The search's own list only
 * holds the editions that happened to rank among other books; this asks for the book itself
 * (bookVolumes). Page counts the list leaves out are not fetched here: the picker asks for the
 * one edition you stop on, so none is dropped for want of a count.
 */
export async function editionVolumes(book: { title: string; author: string }, bookId: string): Promise<GbVolume[]> {
  const volumes = await bookVolumes(book);
  if (!volumes.some((volume) => volume.id === bookId)) {
    try {
      volumes.unshift(await volumeById(bookId));
    } catch (e) {
      if (!(e instanceof GoogleBooksError)) throw e;
    }
  }
  return volumes;
}

/**
 * `volumes.list` often says a paperback has no page count. `volumes.get` for that same id
 * has the count the Google Books site shows. A failure here leaves the list as it was.
 */
async function refillBlankPages(volumes: GbVolume[], pending: string[]): Promise<GbVolume[]> {
  if (pending.length === 0) return volumes;
  const updates = new Map<string, GbVolume>();
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const id = pending[next++];
      try {
        const full = await volumeById(id);
        if (full.pages) updates.set(id, full);
      } catch (e) {
        if (e instanceof GoogleBooksError) continue;
        throw e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, () => worker()));
  if (updates.size === 0) return volumes;
  return volumes.map((volume) => updates.get(volume.id) ?? volume);
}

/** One volume, by its Google Books id. */
export async function volumeById(id: string): Promise<GbVolume> {
  const key = googleVolumeIdOf(id);
  if (!key) throw new GoogleBooksError("That isn't a Google Books volume id.", 400);
  const found = toVolume(await get(`/volumes/${encodeURIComponent(key)}`, { projection: "full" }));
  if (!found || found.id !== key) throw new GoogleBooksError("That isn't on Google Books.", 404);
  return found;
}
