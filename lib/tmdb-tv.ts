// Importing TV shows from TMDB: reading its answers, and the rules for landing a show in the
// library — as a series, with one row per season.
//
// Pure and dependency-free, so the tests can exercise every rule without a network or a database.
// Films are in lib/tmdb.ts, whose readers this shares; the API client is lib/tmdb-service.ts and the
// database side lib/tmdb-tv-import.ts.

import type { LanguageKey } from "@/lib/constants/languages";
import { deriveStatus, tvProgress, WATCH_STATUS } from "@/lib/derive-status";
import { languageFor, normaliseTitle, posterUrl, releaseDateOf, yearOf, type Outcome } from "@/lib/tmdb";

/** What a season's episodes are assumed to run when TMDB has no runtime for any of the show's
 *  episodes — the column's own default. */
export const FALLBACK_RUNTIME = 45;

/** A show as a list shows it: search results, a keyword's shows. */
export interface TmdbShow {
  id: number;
  name: string;
  year: number | null;
  /** "2008-01-20", for ordering shows that started in the same year. */
  released: string | null;
  poster: string | null;
}

export interface TmdbSeason {
  number: number;
  /** null when TMDB lists no episodes yet — never "complete" against nothing. */
  episodeCount: number | null;
  /** Episodes that have aired by `today`: what "watched" marks as watched. */
  airedCount: number;
  /** Average of the season's episode runtimes, in minutes; null when none is known. */
  runtime: number | null;
  year: number | null;
  poster: string | null;
}

/** Everything a show is logged with. */
export interface TmdbShowDetails {
  id: number;
  name: string;
  year: number | null;
  creator: string | null;
  network: string | null;
  language: LanguageKey;
  poster: string | null;
  imdbId: string | null;
  /** Typical episode runtime across the whole show — for a season that has none of its own yet. */
  runtime: number;
  /** Numbered seasons in order. Specials (season 0) are left out: they are rarely watched as a
   *  season, and can be added by hand. */
  seasons: TmdbSeason[];
}

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toShow(raw: Raw | null | undefined): TmdbShow | null {
  if (!raw) return null;
  const id = positiveInt(raw.id);
  const name = text(raw.name);
  if (id === null || !name) return null;
  return {
    id, name, year: yearOf(raw.first_air_date), released: releaseDateOf(raw.first_air_date),
    poster: posterUrl(raw.poster_path, "w92"),
  };
}

/** The numbered seasons a show lists, in order — what to fetch the episodes of. */
export function seasonNumbersOf(raw: Raw | null | undefined): number[] {
  const seasons = Array.isArray(raw?.seasons) ? (raw!.seasons as Raw[]) : [];
  const numbers = new Set<number>();
  for (const season of seasons) {
    const n = positiveInt(season?.season_number);
    if (n !== null) numbers.add(n);
  }
  return [...numbers].sort((a, b) => a - b);
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
}

function episodesOf(season: Raw | undefined): Raw[] {
  return Array.isArray(season?.episodes) ? (season!.episodes as Raw[]) : [];
}

function runtimesOf(episodes: Raw[]): number[] {
  return episodes.map((e) => positiveInt(e?.runtime)).filter((r): r is number => r !== null);
}

/**
 * `/tv/{id}?append_to_response=external_ids` plus each season's own `/season/{n}` answer →
 * what the show is logged with. `today` ("YYYY-MM-DD") decides which episodes have aired.
 */
export function toShowDetails(
  raw: Raw | null | undefined,
  seasonAnswers: Record<number, Raw | undefined>,
  today: string,
): TmdbShowDetails | null {
  if (!raw) return null;
  const id = positiveInt(raw.id);
  const name = text(raw.name);
  if (id === null || !name) return null;

  const listed = new Map<number, Raw>();
  for (const season of Array.isArray(raw.seasons) ? (raw.seasons as Raw[]) : []) {
    const n = positiveInt(season?.season_number);
    if (n !== null && !listed.has(n)) listed.set(n, season);
  }

  const allRuntimes: number[] = [];
  const seasons: TmdbSeason[] = [...listed.keys()].sort((a, b) => a - b).map((number) => {
    const summary = listed.get(number)!;
    const episodes = episodesOf(seasonAnswers[number]);
    const runtimes = runtimesOf(episodes);
    allRuntimes.push(...runtimes);
    const count = episodes.length || positiveInt(summary.episode_count) || 0;
    // An episode with no date has not aired; nor has one dated after today.
    const aired = episodes.filter((e) => {
      const d = releaseDateOf(e?.air_date);
      return d !== null && d <= today;
    }).length;
    return {
      number,
      episodeCount: count > 0 ? count : null,
      airedCount: Math.min(aired, count),
      runtime: average(runtimes),
      year: yearOf(summary.air_date) ?? yearOf((seasonAnswers[number] as Raw | undefined)?.air_date),
      poster: posterUrl(summary.poster_path),
    };
  });

  const listedRuntimes = Array.isArray(raw.episode_run_time)
    ? (raw.episode_run_time as unknown[]).map(positiveInt).filter((r): r is number => r !== null)
    : [];
  const creators = Array.isArray(raw.created_by)
    ? [...new Set((raw.created_by as Raw[]).map((c) => text(c?.name)).filter(Boolean))]
    : [];
  const network = Array.isArray(raw.networks)
    ? (raw.networks as Raw[]).map((n) => text(n?.name)).find(Boolean) ?? null
    : null;
  const imdbId = text((raw.external_ids as Raw | undefined)?.imdb_id);

  return {
    id,
    name,
    year: yearOf(raw.first_air_date),
    creator: creators.length ? creators.join(", ") : null,
    network,
    language: languageFor(raw.original_language),
    poster: posterUrl(raw.poster_path),
    imdbId: /^tt\d{6,10}$/.test(imdbId) ? imdbId : null,
    runtime: average(allRuntimes) ?? average(listedRuntimes) ?? FALLBACK_RUNTIME,
    seasons,
  };
}

/** How a season row is titled — the same shape the Add Season form builds. */
export function seasonTitle(seriesName: string, number: number): string {
  return `${seriesName} | Season ${number}`;
}

// ─── Landing a show in the library ───────────────────────────────────────────

export interface ExistingSeries {
  id: string;
  name: string;
  tmdbId: number | null;
  universeId: string | null;
  universeName: string | null;
}

export type SeriesPlan =
  | { action: "create"; name: string; outcome: "added" }
  | {
      action: "use";
      id: string;
      name: string;
      /** Set the TMDB id on a series made by hand. */
      link: boolean;
      /** Move a standalone series into this universe. */
      moveTo: string | null;
      outcome: Exclude<Outcome, "added">;
      where?: string;
    };

/**
 * Where a show lands, in `universeId` (or standalone, when null). `linked` is the series already
 * carrying the show's TMDB id, if any; `siblings` are the series already in that universe (or
 * already standalone). Same rules as films:
 *
 *  - Already imported: that series is used. A standalone one moves into the universe; one in a
 *    different universe stays put and is reported — which universe is your call.
 *  - Else a series you made by hand, in the same place and with the same name, is linked.
 *  - Else a new series. Its name gets the start year when the plain name is already taken there
 *    ("The Office (2005)" beside "The Office"), since names are unique within a universe.
 */
export function placeSeries(
  linked: ExistingSeries | null,
  siblings: ExistingSeries[],
  show: { id: number; name: string; year: number | null },
  universeId: string | null,
): SeriesPlan {
  if (linked) {
    if (linked.universeId === universeId) {
      return { action: "use", id: linked.id, name: linked.name, link: false, moveTo: null, outcome: "already" };
    }
    if (linked.universeId === null) {
      return { action: "use", id: linked.id, name: linked.name, link: false, moveTo: universeId, outcome: "moved" };
    }
    return {
      action: "use", id: linked.id, name: linked.name, link: false, moveTo: null, outcome: "elsewhere",
      where: linked.universeName ?? "another universe",
    };
  }

  const wanted = normaliseTitle(show.name);
  const byHand = siblings.find((s) => s.tmdbId === null && normaliseTitle(s.name) === wanted);
  if (byHand) {
    return { action: "use", id: byHand.id, name: byHand.name, link: true, moveTo: null, outcome: "linked" };
  }

  const taken = new Set(siblings.map((s) => s.name));
  const candidates = [show.name, ...(show.year ? [`${show.name} (${show.year})`] : []), `${show.name} (TMDB ${show.id})`];
  return { action: "create", name: candidates.find((n) => !taken.has(n)) ?? candidates.at(-1)!, outcome: "added" };
}

export interface ExistingSeason {
  id: string;
  seasonNumber: number | null;
  totalEpisodes: number | null;
  episodesWatched: number;
  year: number | null;
  coverImage: string | null;
  creator: string | null;
  network: string | null;
}

export interface NewSeason {
  title: string;
  seasonNumber: number;
  totalEpisodes: number | null;
  episodesWatched: number;
  episodeRuntime: number;
  year: number | null;
  language: LanguageKey;
  coverImage: string | null;
  creator: string | null;
  network: string | null;
  status: "PLAN_TO_WATCH" | "WATCHING" | "COMPLETED";
}

export interface SeasonUpdate {
  id: string;
  data: {
    totalEpisodes?: number;
    status?: "PLAN_TO_WATCH" | "WATCHING" | "COMPLETED";
    year?: number;
    coverImage?: string;
    creator?: string;
    network?: string;
  };
}

export interface SeasonPlan {
  create: NewSeason[];
  update: SeasonUpdate[];
  /** Season numbers added, and season numbers whose blanks or episode count changed. */
  added: number[];
  updated: number[];
}

/**
 * Merges a show's seasons into a series. Only ever adds:
 *
 *  - A season the series lacks is created. `watched` marks its aired episodes as watched — the
 *    rest stay to watch, so an airing season lands as Watching, not Completed.
 *  - A season it has keeps everything you set: title, episodes watched, runtime, rating, notes,
 *    rewatches, language. Blanks are filled — year, poster, creator, network — and the episode
 *    count is raised when TMDB lists more (a season still airing gains episodes), never lowered.
 *    Status follows from the counts, as everywhere else.
 */
export function planSeasons(
  existing: ExistingSeason[],
  show: TmdbShowDetails,
  { seriesName, watched }: { seriesName: string; watched: boolean },
): SeasonPlan {
  const plan: SeasonPlan = { create: [], update: [], added: [], updated: [] };
  const byNumber = new Map<number, ExistingSeason>();
  for (const season of existing) {
    if (season.seasonNumber !== null && !byNumber.has(season.seasonNumber)) byNumber.set(season.seasonNumber, season);
  }

  for (const season of show.seasons) {
    const current = byNumber.get(season.number);
    if (!current) {
      const total = season.episodeCount;
      const episodesWatched = watched ? Math.min(season.airedCount, total ?? season.airedCount) : 0;
      plan.create.push({
        title: seasonTitle(seriesName, season.number),
        seasonNumber: season.number,
        totalEpisodes: total,
        episodesWatched,
        episodeRuntime: season.runtime ?? show.runtime,
        // Left blank until TMDB dates the season — the show's start year would be wrong for a
        // later season, and a stored year is never overwritten. The next import fills it.
        year: season.year,
        language: show.language,
        coverImage: season.poster ?? show.poster,
        creator: show.creator,
        network: show.network,
        status: deriveStatus(tvProgress({ episodesWatched, totalEpisodes: total }), WATCH_STATUS),
      });
      plan.added.push(season.number);
      continue;
    }

    const data: SeasonUpdate["data"] = {};
    if (season.episodeCount !== null && (current.totalEpisodes === null || season.episodeCount > current.totalEpisodes)) {
      data.totalEpisodes = season.episodeCount;
      const status = deriveStatus(tvProgress({ episodesWatched: current.episodesWatched, totalEpisodes: season.episodeCount }), WATCH_STATUS);
      data.status = status;
    }
    if (current.year === null && season.year !== null) data.year = season.year;
    const poster = season.poster ?? show.poster;
    if (!current.coverImage && poster) data.coverImage = poster;
    if (!current.creator?.trim() && show.creator) data.creator = show.creator;
    if (!current.network?.trim() && show.network) data.network = show.network;
    if (Object.keys(data).length > 0) {
      plan.update.push({ id: current.id, data });
      plan.updated.push(season.number);
    }
  }

  return plan;
}

/** Minutes watched across seasons: every episode watched, once more for each rewatch. */
export function tvWatchedMinutes(
  seasons: { episodesWatched: number; episodeRuntime: number; timesRewatched: number }[],
): number {
  return seasons.reduce((sum, s) => sum + s.episodesWatched * s.episodeRuntime * (s.timesRewatched + 1), 0);
}
