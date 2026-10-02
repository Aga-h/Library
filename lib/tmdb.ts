// Importing films from TMDB: reading its answers, and the rule for landing them in the library.
//
// Pure and dependency-free, so the tests can exercise every rule without a network or a database.
// The API client is lib/tmdb-service.ts; the database side is lib/tmdb-import.ts.
//
// IMDb was the first choice and is not used: its Conditions of Use forbid "robots, screen
// scraping, or similar data gathering" without written consent, and it has no public API. TMDB
// reports each film's IMDb id, which is kept so the app can link to IMDb.

import type { LanguageKey } from "@/lib/constants/languages";

export const TMDB_IMAGE_HOST = "image.tmdb.org";

/** TMDB's attribution notice, which its API terms require be shown wherever its data is used. */
export const TMDB_NOTICE =
  "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/** A film as a list shows it: search results, a collection, a keyword's films. */
export interface TmdbFilm {
  id: number;
  title: string;
  year: number | null;
  /** "2008-04-30", for ordering films released in the same year. */
  released: string | null;
  poster: string | null;
}

export interface TmdbCollection {
  id: number;
  name: string;
  poster: string | null;
}

/** A tag TMDB puts on films — "marvel cinematic universe (mcu)" is how a franchise with no
 *  collection of its own is found. */
export interface TmdbKeyword {
  id: number;
  name: string;
}

/** Everything a film is logged with. */
export interface TmdbDetails {
  id: number;
  title: string;
  year: number | null;
  /** Minutes; 0 when TMDB does not know yet, as for a film not released. */
  runtime: number;
  director: string | null;
  studio: string | null;
  language: LanguageKey;
  poster: string | null;
  imdbId: string | null;
}

type Raw = Record<string, unknown>;

// ─── Reading TMDB's answers ──────────────────────────────────────────────────

// A poster path is a bare file name under the image CDN ("/vfrQk5IP.jpg"). Anything else is
// refused rather than stitched into a URL.
const POSTER_PATH = /^\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i;

/**
 * The URL for a poster at one of TMDB's fixed widths. w500 is what gets stored — sharp on a
 * card at twice its size — and w92 is for search thumbnails.
 */
export function posterUrl(path: unknown, size: "w92" | "w500" = "w500"): string | null {
  if (typeof path !== "string" || !POSTER_PATH.test(path)) return null;
  return `https://${TMDB_IMAGE_HOST}/t/p/${size}${path}`;
}

/** Posters are shown straight from TMDB's CDN — see app/api/movies/mirror-covers. */
export function isTmdbImage(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    return new URL(src).hostname === TMDB_IMAGE_HOST;
  } catch {
    return false;
  }
}

/** "2008-04-30", checked. TMDB sends "" for a film with no date yet. */
export function releaseDateOf(date: unknown): string | null {
  if (typeof date !== "string") return null;
  const d = date.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) > 1800 ? d : null;
}

/** "2008-04-30" → 2008. */
export function yearOf(date: unknown): number | null {
  const d = releaseDateOf(date);
  return d === null ? null : Number(d.slice(0, 4));
}

// TMDB gives the original language as ISO 639-1. "cn" is TMDB's own code for Cantonese.
const LANGUAGES: Record<string, LanguageKey> = {
  en: "ENGLISH", es: "SPANISH", fr: "FRENCH", de: "GERMAN", it: "ITALIAN", pt: "PORTUGUESE",
  tr: "TURKISH", ar: "ARABIC", ru: "RUSSIAN", ja: "JAPANESE", zh: "CHINESE", cn: "CHINESE",
  ko: "KOREAN",
};

/**
 * The library's language for a film. A language the library has no entry for falls back to
 * English, the column's own default — it only labels the film, nothing is computed from it.
 */
export function languageFor(code: unknown): LanguageKey {
  return (typeof code === "string" && LANGUAGES[code.trim().toLowerCase()]) || "ENGLISH";
}

/** Every credited director, in TMDB's order: "Anthony Russo, Joe Russo". */
export function directorsOf(credits: unknown): string | null {
  const crew = (credits as Raw | null | undefined)?.crew;
  if (!Array.isArray(crew)) return null;
  const names: string[] = [];
  for (const person of crew as Raw[]) {
    if (person?.job !== "Director" || typeof person.name !== "string") continue;
    const name = person.name.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? names.join(", ") : null;
}

/** The first production company TMDB lists, which is the lead studio. */
export function studioOf(companies: unknown): string | null {
  if (!Array.isArray(companies)) return null;
  for (const company of companies as Raw[]) {
    const name = typeof company?.name === "string" ? company.name.trim() : "";
    if (name) return name;
  }
  return null;
}

function idOf(raw: Raw): number | null {
  const id = Number(raw.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toFilm(raw: Raw | null | undefined): TmdbFilm | null {
  if (!raw) return null;
  const id = idOf(raw);
  const title = text(raw.title);
  if (id === null || !title) return null;
  return {
    id, title, year: yearOf(raw.release_date), released: releaseDateOf(raw.release_date),
    poster: posterUrl(raw.poster_path, "w92"),
  };
}

export function toCollection(raw: Raw | null | undefined): TmdbCollection | null {
  if (!raw) return null;
  const id = idOf(raw);
  const name = text(raw.name);
  if (id === null || !name) return null;
  return { id, name, poster: posterUrl(raw.poster_path, "w92") };
}

export function toKeyword(raw: Raw | null | undefined): TmdbKeyword | null {
  if (!raw) return null;
  const id = idOf(raw);
  const name = text(raw.name);
  if (id === null || !name) return null;
  return { id, name };
}

/** `/movie/{id}?append_to_response=credits` → what the film is logged with. */
export function toDetails(raw: Raw | null | undefined): TmdbDetails | null {
  if (!raw) return null;
  const id = idOf(raw);
  const title = text(raw.title);
  if (id === null || !title) return null;
  const runtime = Number(raw.runtime);
  const imdbId = text(raw.imdb_id);
  return {
    id,
    title,
    year: yearOf(raw.release_date),
    runtime: Number.isInteger(runtime) && runtime > 0 ? runtime : 0,
    director: directorsOf(raw.credits),
    studio: studioOf(raw.production_companies),
    language: languageFor(raw.original_language),
    poster: posterUrl(raw.poster_path),
    imdbId: /^tt\d{6,10}$/.test(imdbId) ? imdbId : null,
  };
}

// ─── Landing an import in the library ────────────────────────────────────────

/** A film already in the library, with what the merge needs to know about it. */
export interface ExistingMovie {
  id: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  director: string | null;
  studio: string | null;
  runtime: number;
  coverImage: string | null;
  universeId: string | null;
  universeName: string | null;
}

/** A new row, less the status and universe the caller decides. */
export interface NewMovie {
  title: string;
  year: number | null;
  runtime: number;
  director: string | null;
  studio: string | null;
  language: LanguageKey;
  coverImage: string | null;
  tmdbId: number;
  imdbId: string | null;
}

export interface MovieUpdate {
  id: string;
  data: {
    tmdbId?: number;
    imdbId?: string;
    director?: string;
    studio?: string;
    runtime?: number;
    year?: number;
    coverImage?: string;
    universeId?: string;
  };
}

/**
 * What happened to each film:
 *  - added:     new to the library
 *  - linked:    matched a film you had added by hand, which is now tied to TMDB
 *  - moved:     was standalone, now in the universe being imported into
 *  - already:   was already where it was being imported to
 *  - elsewhere: is in a different universe, and was left there
 */
export type Outcome = "added" | "linked" | "moved" | "already" | "elsewhere";

export interface ReportLine {
  tmdbId: number;
  title: string;
  year: number | null;
  outcome: Outcome;
  /** For "elsewhere": the universe it is in. */
  where?: string;
  /** The library row, when there is one already. New rows get theirs after the insert. */
  movieId?: string;
}

export interface ImportPlan {
  create: NewMovie[];
  update: MovieUpdate[];
  report: ReportLine[];
}

/**
 * Titles compared loosely: case, punctuation, "&" against "and" and spacing don't count, and an
 * apostrophe is dropped rather than spaced, so "Journey's" matches a typed "Journeys".
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Lands a batch of TMDB films in the library, in `universeId` (or standalone, when null).
 *
 * A film is matched to a library row by its TMDB id, or else — once — to a film added by hand
 * with the same title and year (or no year). The merge only ever adds:
 *
 *  - Blanks get filled: director, studio, year, poster, IMDb id, and a runtime of 0. Everything
 *    you set yourself — title, status, rating, rewatches, notes, language, a cover you chose — is
 *    never touched. Importing a film again is therefore how a runtime appears once it is out.
 *  - A standalone film moves into the universe it is imported into. A film in a different
 *    universe stays where it is and is reported — a film is in at most one universe, and which
 *    one is your call, not an import's.
 */
export function planImport(
  existing: ExistingMovie[],
  incoming: TmdbDetails[],
  universeId: string | null,
): ImportPlan {
  const plan: ImportPlan = { create: [], update: [], report: [] };
  const byTmdb = new Map<number, ExistingMovie>();
  const handAdded: ExistingMovie[] = [];
  for (const movie of existing) {
    if (movie.tmdbId === null) handAdded.push(movie);
    else byTmdb.set(movie.tmdbId, movie);
  }
  const claimed = new Set<string>();
  const seen = new Set<number>();

  const matchByHand = (film: TmdbDetails): ExistingMovie | undefined => {
    const title = normaliseTitle(film.title);
    const candidates = handAdded.filter((m) => !claimed.has(m.id) && normaliseTitle(m.title) === title);
    // An exact year beats a row with no year, so a remake never takes the original's entry.
    return (
      candidates.find((m) => m.year !== null && m.year === film.year) ??
      candidates.find((m) => m.year === null || film.year === null)
    );
  };

  for (const film of incoming) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);

    const current = byTmdb.get(film.id) ?? matchByHand(film);
    if (!current) {
      plan.create.push({
        title: film.title,
        year: film.year,
        runtime: film.runtime,
        director: film.director,
        studio: film.studio,
        language: film.language,
        coverImage: film.poster,
        tmdbId: film.id,
        imdbId: film.imdbId,
      });
      plan.report.push({ tmdbId: film.id, title: film.title, year: film.year, outcome: "added" });
      continue;
    }
    claimed.add(current.id);

    const data: MovieUpdate["data"] = {};
    if (current.tmdbId === null) data.tmdbId = film.id;
    if (!current.imdbId && film.imdbId) data.imdbId = film.imdbId;
    if (!current.director?.trim() && film.director) data.director = film.director;
    if (!current.studio?.trim() && film.studio) data.studio = film.studio;
    if (current.runtime <= 0 && film.runtime > 0) data.runtime = film.runtime;
    if (current.year === null && film.year !== null) data.year = film.year;
    if (!current.coverImage && film.poster) data.coverImage = film.poster;

    let outcome: Outcome;
    let where: string | undefined;
    if (current.universeId === universeId) {
      outcome = current.tmdbId === null ? "linked" : "already";
    } else if (current.universeId === null) {
      // Only reachable with a universe to move into: null === null was the branch above.
      data.universeId = universeId!;
      outcome = "moved";
    } else {
      outcome = "elsewhere";
      where = current.universeName ?? "another universe";
    }

    if (Object.keys(data).length > 0) plan.update.push({ id: current.id, data });
    plan.report.push({
      tmdbId: film.id,
      title: current.title,
      year: current.year ?? film.year,
      outcome,
      ...(where ? { where } : {}),
      movieId: current.id,
    });
  }

  return plan;
}

/**
 * The order a batch of films is listed — and so imported — in: by release date, undated last,
 * then by title with numbers read as numbers ("Part 2" before "Part 10").
 */
export function byRelease<T extends { year: number | null; released?: string | null; title: string }>(a: T, b: T): number {
  // A full date where there is one; a bare year sorts ahead of the dated films of that year.
  const key = (f: T) => f.released ?? (f.year !== null ? String(f.year) : null);
  const ka = key(a), kb = key(b);
  if (ka !== kb) {
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka < kb ? -1 : 1;
  }
  return a.title.localeCompare(b.title, undefined, { numeric: true });
}
