// Talking to TMDB. Server-only: it reads TMDB_API_KEY, which must never reach a browser. Pure
// rules live in lib/tmdb.ts (films) and lib/tmdb-tv.ts (shows).
//
// Only documented endpoints: /search/{movie,tv,collection,keyword}, /collection/{id}, /keyword/{id},
// /discover/{movie,tv}?with_keywords=, /movie/{id}?append_to_response=credits and
// /tv/{id}?append_to_response=external_ids | season/1,season/2,…

import {
  byRelease, toCollection, toDetails, toFilm, toKeyword,
  type TmdbCollection, type TmdbFilm, type TmdbKeyword,
} from "@/lib/tmdb";
import { seasonNumbersOf, toShow, toShowDetails, type TmdbShow, type TmdbShowDetails } from "@/lib/tmdb-tv";

/** Overridable so the importer can be tested against a local stand-in; production never sets it. */
const BASE_URL = (process.env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3").replace(/\/$/, "");

/** A keyword's films are listed 20 to a page; five pages is more than any real franchise. */
const KEYWORD_PAGES = 5;

/** How many films one import may bring in. A preview never offers more than this. */
export const MAX_IMPORT = 100;

/** How many shows one import may bring in — each is a series and all its seasons. */
export const MAX_SHOW_IMPORT = 50;

/** TMDB appends at most 20 sub-requests to one call, so seasons are fetched 20 at a time. */
const APPEND_LIMIT = 20;

/** Detail requests in flight at once — well under TMDB's limit of ~50 a second. */
const CONCURRENCY = 6;

export class TmdbError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * TMDB issues two credentials, and either works: a short v3 "API Key", sent as a query
 * parameter, and a long "API Read Access Token" (a JWT), sent as a bearer header.
 */
function credentials(): { headers: Record<string, string>; params: Record<string, string> } {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) throw new TmdbError("TMDB isn't set up — add TMDB_API_KEY to the site's environment.", 503);
  return key.startsWith("eyJ")
    ? { headers: { Authorization: `Bearer ${key}` }, params: {} }
    : { headers: {}, params: { api_key: key } };
}

type Raw = Record<string, unknown>;

async function get(path: string, params: Record<string, string> = {}): Promise<Raw> {
  const { headers, params: auth } = credentials();
  const url = new URL(`${BASE_URL}${path}`);
  url.search = new URLSearchParams({ ...params, ...auth }).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { ...headers, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    // The URL is never echoed: with a v3 key it carries the key.
    throw new TmdbError("Couldn't reach TMDB — try again in a minute.", 502);
  }

  if (res.status === 401) throw new TmdbError("TMDB refused the API key — check TMDB_API_KEY.", 502);
  if (res.status === 404) throw new TmdbError("That isn't on TMDB.", 404);
  if (res.status === 429) throw new TmdbError("TMDB is rate-limiting requests — wait a moment and try again.", 429);
  const body = (await res.json().catch(() => null)) as Raw | null;
  if (!res.ok || !body) throw new TmdbError(`TMDB answered ${res.status}.`, 502);
  return body;
}

function list<T>(body: Raw, key: string, read: (raw: Raw) => T | null): T[] {
  const rows = Array.isArray(body[key]) ? (body[key] as Raw[]) : [];
  return rows.map(read).filter((x): x is T => x !== null);
}

export interface SearchResults {
  films: TmdbFilm[];
  collections: TmdbCollection[];
  keywords: TmdbKeyword[];
}

/** Films, collections and keyword tags matching a search, each in TMDB's relevance order. */
export async function search(query: string): Promise<SearchResults> {
  const [films, collections, keywords] = await Promise.all([
    get("/search/movie", { query, include_adult: "false" }),
    get("/search/collection", { query, include_adult: "false" }),
    get("/search/keyword", { query }),
  ]);
  return {
    films: list(films, "results", toFilm).slice(0, 12),
    collections: list(collections, "results", toCollection).slice(0, 6),
    keywords: list(keywords, "results", toKeyword).slice(0, 6),
  };
}

export interface FilmList {
  name: string;
  films: TmdbFilm[];
  /** How many films TMDB has under it; more than `films.length` when the list was cut short. */
  total: number;
}

/** A collection — "Harry Potter Collection" — and its films in release order. */
export async function collectionFilms(id: number): Promise<FilmList> {
  const body = await get(`/collection/${id}`);
  const films = list(body, "parts", toFilm).sort(byRelease);
  return { name: typeof body.name === "string" ? body.name : "Collection", films, total: films.length };
}

/** Every film tagged with a keyword, oldest first, up to MAX_IMPORT of them. */
export async function keywordFilms(id: number): Promise<FilmList> {
  const keyword = toKeyword(await get(`/keyword/${id}`));
  const films: TmdbFilm[] = [];
  let total = 0;
  for (let page = 1; page <= KEYWORD_PAGES; page++) {
    const body = await get("/discover/movie", {
      with_keywords: String(id),
      sort_by: "primary_release_date.asc",
      include_adult: "false",
      include_video: "false",
      page: String(page),
    });
    total = Number(body.total_results) || 0;
    films.push(...list(body, "results", toFilm));
    if (page >= (Number(body.total_pages) || 0)) break;
  }
  // Discover sorts undated films first; release order with them last reads better.
  return { name: keyword?.name ?? "Keyword", films: films.slice(0, MAX_IMPORT).sort(byRelease), total };
}

/**
 * Fetches each id's details, a few requests at a time. One TMDB cannot answer for is reported
 * rather than failing the whole batch — unless it is the key or the rate limit, which would fail
 * every one of them.
 */
async function detailsFor<T extends { id: number }>(
  ids: number[],
  fetchOne: (id: number) => Promise<T | null>,
  noun: string,
): Promise<{ details: T[]; failed: { tmdbId: number; reason: string }[] }> {
  const details: T[] = [];
  const failed: { tmdbId: number; reason: string }[] = [];
  let next = 0;

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        const one = await fetchOne(id);
        if (one) details.push(one);
        else failed.push({ tmdbId: id, reason: `TMDB sent the ${noun} without a name` });
      } catch (e) {
        // Only a missing one is that one's problem; anything else would fail every one of them.
        if (!(e instanceof TmdbError) || e.status !== 404) throw e;
        failed.push({ tmdbId: id, reason: "not found on TMDB" });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  // Workers finish in any order; the order asked for is the order kept.
  const position = new Map(ids.map((id, i) => [id, i]));
  details.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  return { details, failed };
}

/** Full details for each film. */
export async function filmDetails(ids: number[]) {
  return detailsFor(ids, async (id) => toDetails(await get(`/movie/${id}`, { append_to_response: "credits" })), "film");
}

// ─── TV ──────────────────────────────────────────────────────────────────────

/** Shows and keyword tags matching a search. TV has no collections on TMDB. */
export async function searchTv(query: string): Promise<{ shows: TmdbShow[]; keywords: TmdbKeyword[] }> {
  const [shows, keywords] = await Promise.all([
    get("/search/tv", { query, include_adult: "false" }),
    get("/search/keyword", { query }),
  ]);
  return {
    shows: list(shows, "results", toShow).slice(0, 12),
    keywords: list(keywords, "results", toKeyword).slice(0, 6),
  };
}

export interface ShowList {
  name: string;
  shows: TmdbShow[];
  total: number;
}

/** Every show tagged with a keyword, oldest first, up to MAX_SHOW_IMPORT of them. */
export async function keywordShows(id: number): Promise<ShowList> {
  const keyword = toKeyword(await get(`/keyword/${id}`));
  const shows: TmdbShow[] = [];
  let total = 0;
  for (let page = 1; page <= Math.ceil(MAX_SHOW_IMPORT / 20); page++) {
    const body = await get("/discover/tv", {
      with_keywords: String(id),
      sort_by: "first_air_date.asc",
      include_adult: "false",
      page: String(page),
    });
    total = Number(body.total_results) || 0;
    shows.push(...list(body, "results", toShow));
    if (page >= (Number(body.total_pages) || 0)) break;
  }
  // Discover sorts undated shows first; release order with them last reads better.
  const ordered = shows.slice(0, MAX_SHOW_IMPORT)
    .sort((a, b) => byRelease({ ...a, title: a.name }, { ...b, title: b.name }));
  return { name: keyword?.name ?? "Keyword", shows: ordered, total };
}

/**
 * A show with every season's episodes: one call for the show and its IMDb id, then the seasons
 * appended 20 to a call. `today` ("YYYY-MM-DD", the app's own zone) decides what has aired.
 */
export async function showDetails(ids: number[], today: string) {
  return detailsFor<TmdbShowDetails>(ids, async (id) => {
    const head = await get(`/tv/${id}`, { append_to_response: "external_ids" });
    const numbers = seasonNumbersOf(head);
    const seasons: Record<number, Raw | undefined> = {};
    for (let i = 0; i < numbers.length; i += APPEND_LIMIT) {
      const chunk = numbers.slice(i, i + APPEND_LIMIT);
      const body = await get(`/tv/${id}`, { append_to_response: chunk.map((n) => `season/${n}`).join(",") });
      for (const n of chunk) seasons[n] = body[`season/${n}`] as Raw | undefined;
    }
    return toShowDetails(head, seasons, today);
  }, "show");
}
