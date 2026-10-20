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
  editionSearchQueries, googleSearchQueryOf, googleVolumeIdOf, groupEditions, seriesOnly, toVolume, volumesToRefetch,
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
 * quick 503 "Service temporarily unavailable"; the same request usually succeeds a moment later,
 * so a search is asked up to 12 times. Looking up one volume hardly ever fails.
 */
const SEARCH_PAUSES = [250, 250, 500, 500, 750, 750, 1000, 1000, 1000, 1000, 1000];
const VOLUME_PAUSES = [300, 1000];
const PASSING = new Set([500, 502, 503, 504]);
/** One request, every try included, so a search and its page counts fit in a route's 60s. */
const CALL_LIMIT = 15_000;
const TRY_LIMIT = 8_000;

async function get(path: string, params: Record<string, string> = {}): Promise<Raw> {
  const url = new URL(`${baseUrl()}${path}`);
  const search = new URLSearchParams(params);
  // Google answers a server it can't place on the map with a 403 ("Cannot determine user
  // location"). Saying where we are makes every server get the same, US, results.
  search.set("country", "US");
  const key = apiKey();
  if (key) search.set("key", key);
  url.search = search.toString();

  const pauses = path === "/volumes" ? SEARCH_PAUSES : VOLUME_PAUSES;
  const deadline = Date.now() + CALL_LIMIT;
  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1, Math.min(TRY_LIMIT, deadline - Date.now()))),
        cache: "no-store",
      });
    } catch {
      res = null;
    }
    // A 429 is asked once more; a brief outage, once per pause, while a try still has a second.
    const again = res === null || PASSING.has(res.status) ? attempt < pauses.length
      : res.status === 429 ? attempt === 0 : false;
    if (!again || Date.now() + pauses[attempt] + 1000 >= deadline) break;
    await pause(pauses[attempt]);
  }
  if (!res) throw new GoogleBooksError("Couldn't reach Google Books — try again in a minute.", 502);

  if (res.status === 404) throw new GoogleBooksError("That isn't on Google Books.", 404);
  if (res.status === 429) {
    // The key's "Queries per day" (1,000 by default) ends at midnight Pacific; waiting a moment won't help.
    const daily = /per day/i.test(await res.text().catch(() => ""));
    throw new GoogleBooksError(
      !apiKey()
        ? "Google Books needs GOOGLE_BOOKS_API_KEY — set it in Vercel, enable the Books API, and redeploy."
        : daily
          ? "Google Books' daily limit for this API key is used up — it starts again at midnight Pacific time."
          : "Google Books is rate-limiting requests — wait a moment and try again.",
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
  const started = Date.now();
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
  let first: Raw;
  try {
    first = await get("/volumes", params);
  } catch (e) {
    // isbn: finds nothing at the moment anyway, so Google refusing it isn't the end of it — unless
    // nothing else finds the book either: then why (no key, the day's limit, an outage) is the answer.
    if (asked.kind !== "isbn" || !(e instanceof GoogleBooksError)) throw e;
    const found = await volumesForIsbn(asked.value, started);
    if (found.length === 0) throw e;
    return found;
  }
  const rows = Array.isArray(first.items) ? [...(first.items as Raw[])] : [];
  // A second page so a paperback buried under Kindle listings can still be collapsed in. Not
  // gated on totalItems: Google says 1 while sending 20. It sends at most 20 per page. Page 1 is
  // worth showing on its own, so a page 2 Google keeps refusing is left out.
  if (rows.length > 0) {
    try {
      const second = await get("/volumes", { ...params, startIndex: String(rows.length) });
      if (Array.isArray(second.items)) rows.push(...(second.items as Raw[]));
    } catch (e) {
      if (!(e instanceof GoogleBooksError)) throw e;
    }
  }
  const volumes = volumesOf({ items: rows });
  if (asked.kind === "isbn" && volumes.length === 0) return volumesForIsbn(asked.value, started);
  return refillBlankPages(volumes, volumesToRefetch(volumes, asked.value), started + REFILL_BY);
}

/**
 * Google Books answers every `isbn:` search with nothing since about 1 Oct 2026 (plain words
 * still work). Open Library says which book the ISBN is, that book is searched on Google the way
 * the edition picker does, and the listing with the ISBN is the answer — else, if Google has no
 * listing with it or no page count for it, the book's other listings, so it can still be added.
 * Page counts are looked up only until REFILL_BY after the search `started`, like any search.
 */
async function volumesForIsbn(isbn: string, started: number): Promise<GbVolume[]> {
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
  const deadline = started + REFILL_BY;
  if (exact) {
    // volumes.get's count, the one Google's page shows and an import stores (the list can say 542 for 541).
    const [checked] = await refillBlankPages([exact], [exact.id], deadline);
    if (checked.pages) return [checked];
  }
  const others = group.filter((row) => row !== book) as GbVolume[];
  return refillBlankPages(others, volumesToRefetch(others, book.title), deadline);
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
 * (bookVolumes). Page counts the list leaves out are not fetched here — the picker asks for the
 * one edition you stop on — except for a few listings titled only by the series (seriesOnly):
 * groupEditions places those by their length.
 */
export async function editionVolumes(book: { title: string; author: string }, bookId: string): Promise<GbVolume[]> {
  const fetched = await bookVolumes(book);
  const unplaced = seriesOnly(fetched).filter((v) => v.pages === null && v.cover).map((v) => v.id);
  const volumes = await refillBlankPages(fetched, unplaced.slice(0, SERIES_LOOKUPS), Date.now() + CALL_LIMIT);
  if (!volumes.some((volume) => volume.id === bookId)) {
    try {
      volumes.unshift(await volumeById(bookId));
    } catch (e) {
      if (!(e instanceof GoogleBooksError)) throw e;
    }
  }
  return volumes;
}

/** At most this many series-titled listings get their page count looked up for the picker. */
const SERIES_LOOKUPS = 4;

/** Page-count lookups start no later than this after a search began: the route has 60s. */
const REFILL_BY = 40_000;

/**
 * `volumes.list` often says a paperback has no page count. `volumes.get` for that same id
 * has the count the Google Books site shows. A failure here leaves the list as it was, and so
 * does running out of time: none is started after `deadline`.
 */
async function refillBlankPages(volumes: GbVolume[], pending: string[], deadline: number): Promise<GbVolume[]> {
  if (pending.length === 0) return volumes;
  const updates = new Map<string, GbVolume>();
  let next = 0;
  async function worker() {
    while (next < pending.length && Date.now() < deadline) {
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
