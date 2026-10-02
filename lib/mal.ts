// Importing anime from MyAnimeList: reading its answers, and the rules for landing a run of
// entries in the library — as a series, one row per entry, in watch order.
//
// Pure and dependency-free, so the tests can exercise every rule without a network or a database.
// The API client is lib/mal-service.ts; the database side lib/mal-import.ts.
//
// Only the official MyAnimeList API (v2) is used. Not the website — its robots.txt turns away
// Claude's crawlers — and not Jikan, which works by scraping that website. The API license allows
// personal, non-commercial use, asks that MyAnimeList be credited as the source, and forbids
// altering its content: titles are stored exactly as MyAnimeList gives them.

import { deriveStatus, animeProgress, WATCH_STATUS } from "@/lib/derive-status";
import { normaliseTitle, type Outcome } from "@/lib/tmdb";

export const MAL_IMAGE_HOST = "cdn.myanimelist.net";

/** What an episode is assumed to run when MyAnimeList has no duration — the column's default. */
export const FALLBACK_DURATION = 24;

/** Entry kinds left unticked in a preview: music videos and promos are rarely "watched". */
export const UNTICKED_MEDIA = new Set(["music", "pv", "cm"]);

export type AiringSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface MalEntry {
  id: number;
  /** MyAnimeList's main title — usually romaji ("Shingeki no Kyojin"). */
  title: string;
  /** Its English title, when it has one ("Attack on Titan"). */
  titleEn: string | null;
  synonyms: string[];
  year: number | null;
  /** "2013-04-07", "2013-04" or "2013" — as precise as MAL knows it. For ordering. */
  startDate: string | null;
  season: AiringSeason | null;
  /** "tv", "movie", "ova", "ona", "special", "music", … */
  mediaType: string;
  airing: "finished" | "airing" | "upcoming";
  /** null when MAL does not know yet (it sends 0). */
  episodes: number | null;
  /** Minutes per episode; null when MAL does not know. */
  duration: number | null;
  studio: string | null;
  poster: string | null;
  /** Entries this one continues from or leads to — the links a run is walked along. */
  sequels: number[];
  prequels: number[];
}

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** A MAL image URL, checked: https, on MAL's own CDN. Anything else is refused. */
export function malImage(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === MAL_IMAGE_HOST ? u.href : null;
  } catch {
    return null;
  }
}

/** Posters are shown straight from MAL's CDN — see app/api/anime/mirror-covers. */
export function isMalImage(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    return new URL(src).hostname === MAL_IMAGE_HOST;
  } catch {
    return false;
  }
}

/** "2013-04-07" / "2013-04" / "2013", checked. */
export function startDateOf(value: unknown): string | null {
  const d = text(value);
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(d) && Number(d.slice(0, 4)) > 1900 ? d : null;
}

const SEASONS: Record<string, AiringSeason> = { winter: "WINTER", spring: "SPRING", summer: "SUMMER", fall: "FALL" };
const AIRING: Record<string, MalEntry["airing"]> = {
  finished_airing: "finished", currently_airing: "airing", not_yet_aired: "upcoming",
};

function relatedOf(raw: Raw, kind: string): number[] {
  const rows = Array.isArray(raw.related_anime) ? (raw.related_anime as Raw[]) : [];
  const ids: number[] = [];
  for (const row of rows) {
    if (row?.relation_type !== kind) continue;
    const id = positiveInt((row.node as Raw | undefined)?.id);
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** One entry, from a search result's `node` or from `/anime/{id}` (which adds the links). */
export function toEntry(raw: Raw | null | undefined): MalEntry | null {
  if (!raw) return null;
  const id = positiveInt(raw.id);
  const title = text(raw.title);
  if (id === null || !title) return null;

  const alt = (raw.alternative_titles as Raw | undefined) ?? {};
  const titleEn = text(alt.en) || null;
  const synonyms = Array.isArray(alt.synonyms) ? (alt.synonyms as unknown[]).map(text).filter(Boolean) : [];
  const startDate = startDateOf(raw.start_date);
  const startSeason = (raw.start_season as Raw | undefined) ?? {};
  const seasonYear = positiveInt(startSeason.year);
  const seconds = positiveInt(raw.average_episode_duration);
  const studio = Array.isArray(raw.studios)
    ? (raw.studios as Raw[]).map((s) => text(s?.name)).find(Boolean) ?? null
    : null;
  const pictures = (raw.main_picture as Raw | undefined) ?? {};

  return {
    id,
    title,
    titleEn: titleEn && titleEn !== title ? titleEn : null,
    synonyms,
    year: seasonYear ?? (startDate ? Number(startDate.slice(0, 4)) : null),
    startDate,
    season: SEASONS[text(startSeason.season).toLowerCase()] ?? null,
    mediaType: text(raw.media_type).toLowerCase() || "unknown",
    airing: AIRING[text(raw.status)] ?? "upcoming",
    episodes: positiveInt(raw.num_episodes),
    duration: seconds ? Math.max(1, Math.round(seconds / 60)) : null,
    studio,
    poster: malImage(pictures.large) ?? malImage(pictures.medium),
    sequels: relatedOf(raw, "sequel"),
    prequels: relatedOf(raw, "prequel"),
  };
}

/** The title to store: the English one when asked for and there is one, else MAL's own. */
export function titleFor(entry: MalEntry, english: boolean): string {
  return english && entry.titleEn ? entry.titleEn : entry.title;
}

/** Watch order: by start date (a bare year first within its year), undated last, then by id. */
export function byAiring(a: MalEntry, b: MalEntry): number {
  if (a.startDate !== b.startDate) {
    if (a.startDate === null) return 1;
    if (b.startDate === null) return -1;
    return a.startDate < b.startDate ? -1 : 1;
  }
  return a.id - b.id;
}

// ─── Landing a run in the library ────────────────────────────────────────────

export interface ExistingAnime {
  id: string;
  title: string;
  year: number | null;
  malId: number | null;
  studio: string | null;
  episodes: number | null;
  episodesWatched: number;
  season: AiringSeason | null;
  coverImage: string | null;
  seasonNumber: number | null;
  seriesId: string | null;
  seriesName: string | null;
  seriesUniverseId: string | null;
  seriesUniverseName: string | null;
}

export interface ExistingSeries {
  id: string;
  name: string;
  /** Holds anything imported from MyAnimeList — then it is some other run's series, never "yours
   *  by hand", however its name reads. */
  fromMal: boolean;
}

/**
 * Pairs each entry with the row it already is, if any: by MAL id, or else — once — by a title you
 * typed that matches any of its titles, with the same year (or no year on either side).
 */
export function matchEntries(existing: ExistingAnime[], entries: MalEntry[]): Map<number, ExistingAnime> {
  const matches = new Map<number, ExistingAnime>();
  const byMal = new Map(existing.filter((r) => r.malId !== null).map((r) => [r.malId!, r]));
  const byHand = existing.filter((r) => r.malId === null);
  const claimed = new Set<string>();

  for (const entry of entries) {
    const linked = byMal.get(entry.id);
    if (linked) {
      matches.set(entry.id, linked);
      continue;
    }
    const names = new Set([entry.title, entry.titleEn, ...entry.synonyms].filter(Boolean).map((t) => normaliseTitle(t!)));
    const candidates = byHand.filter((r) => !claimed.has(r.id) && names.has(normaliseTitle(r.title)));
    const row =
      candidates.find((r) => r.year !== null && r.year === entry.year) ??
      candidates.find((r) => r.year === null || entry.year === null);
    if (row) {
      claimed.add(row.id);
      matches.set(entry.id, row);
    }
  }
  return matches;
}

export type SeriesChoice =
  | { action: "none" }
  | { action: "create"; name: string }
  | {
      action: "use";
      id: string;
      name: string;
      /** Move a standalone series into the universe being imported into. */
      moveTo: string | null;
      outcome: "already" | "moved" | "linked" | "elsewhere";
      where?: string;
    };

/**
 * Which series a run lands in, imported into `universeId` (standalone when null):
 *
 *  - One entry imported standalone, and not already in a series: no series — it stays a single
 *    anime, like a film.
 *  - Entries already in a series: that series (the one holding most of them). A standalone series
 *    moves into the universe; one in a different universe stays put and is reported, and new
 *    entries join it there.
 *  - Else a series you made by hand (nothing in it from MyAnimeList), in that place, named like
 *    the run: that one. A same-named series holding another run's entries is not it — the 1999 and
 *    2011 Hunter x Hunter are both "Hunter x Hunter".
 *  - Else a new series named after the run's first entry; when that name is taken there, its year
 *    is added ("Hunter x Hunter (2011)"), then its MAL id.
 */
export function chooseSeries(
  matches: Map<number, ExistingAnime>,
  siblings: ExistingSeries[],
  run: { name: string; year: number | null; firstId: number; count: number },
  universeId: string | null,
): SeriesChoice {
  const counts = new Map<string, { row: ExistingAnime; n: number }>();
  for (const row of matches.values()) {
    if (!row.seriesId) continue;
    const seen = counts.get(row.seriesId);
    if (seen) seen.n++;
    else counts.set(row.seriesId, { row, n: 1 });
  }

  if (counts.size > 0) {
    const { row } = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    const base = { action: "use" as const, id: row.seriesId!, name: row.seriesName ?? run.name };
    if (row.seriesUniverseId === universeId) return { ...base, moveTo: null, outcome: "already" };
    if (row.seriesUniverseId === null) return { ...base, moveTo: universeId, outcome: "moved" };
    return { ...base, moveTo: null, outcome: "elsewhere", where: row.seriesUniverseName ?? "another universe" };
  }

  if (universeId === null && run.count === 1) return { action: "none" };

  const wanted = normaliseTitle(run.name);
  const byHand = siblings.find((s) => !s.fromMal && normaliseTitle(s.name) === wanted);
  if (byHand) return { action: "use", id: byHand.id, name: byHand.name, moveTo: null, outcome: "linked" };

  const taken = new Set(siblings.map((s) => s.name));
  const candidates = [run.name, ...(run.year ? [`${run.name} (${run.year})`] : []), `${run.name} (MAL ${run.firstId})`];
  return { action: "create", name: candidates.find((n) => !taken.has(n)) ?? candidates.at(-1)! };
}

export interface NewAnime {
  title: string;
  malId: number;
  studio: string | null;
  episodes: number | null;
  episodesWatched: number;
  episodeDuration: number;
  season: AiringSeason | null;
  year: number | null;
  language: "JAPANESE";
  coverImage: string | null;
  seasonNumber: number | null;
  status: "PLAN_TO_WATCH" | "WATCHING" | "COMPLETED";
}

export interface AnimeUpdate {
  id: string;
  data: {
    malId?: number;
    studio?: string;
    episodes?: number;
    status?: "PLAN_TO_WATCH" | "WATCHING" | "COMPLETED";
    season?: AiringSeason;
    year?: number;
    coverImage?: string;
    seasonNumber?: number;
    /** Into the run's series: only ever from standalone. */
    seriesId?: string;
  };
}

export interface EntryLine {
  malId: number;
  title: string;
  outcome: Outcome;
  where?: string;
  /** The library row, when there was one already. New rows get theirs after the insert. */
  animeId?: string;
}

export interface EntryPlan {
  create: NewAnime[];
  update: AnimeUpdate[];
  report: EntryLine[];
}

/**
 * Merges a run's entries, in watch order, into `seriesId` (null: a single standalone anime).
 * Only ever adds:
 *
 *  - A new entry is created as the next season of the series. `watched` marks a finished entry
 *    fully watched; one still airing has no episode dates on MyAnimeList, so it is left at 0.
 *  - An entry you have keeps everything you set: title, episodes watched, episode length, rating,
 *    notes, rewatches, language. Blanks are filled — studio, airing season, year, poster, season
 *    number — the episode count rises when MAL lists more (never falls), and status follows.
 *  - A standalone entry joins the series; one in a different series stays there and is reported.
 */
export function planEntries(
  entries: MalEntry[],
  matches: Map<number, ExistingAnime>,
  series: { id: string | null; highestSeason: number },
  { watched, english }: { watched: boolean; english: boolean },
): EntryPlan {
  const plan: EntryPlan = { create: [], update: [], report: [] };
  let next = series.highestSeason;
  const seen = new Set<number>();

  for (const entry of [...entries].sort(byAiring)) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const row = matches.get(entry.id);

    if (!row) {
      const episodesWatched = watched && entry.airing === "finished" && entry.episodes ? entry.episodes : 0;
      const title = titleFor(entry, english);
      plan.create.push({
        title,
        malId: entry.id,
        studio: entry.studio,
        episodes: entry.episodes,
        episodesWatched,
        episodeDuration: entry.duration ?? FALLBACK_DURATION,
        season: entry.season,
        year: entry.year,
        language: "JAPANESE",
        coverImage: entry.poster,
        seasonNumber: series.id ? ++next : null,
        status: deriveStatus(animeProgress({ episodesWatched, episodes: entry.episodes }), WATCH_STATUS),
      });
      plan.report.push({ malId: entry.id, title, outcome: "added" });
      continue;
    }

    const data: AnimeUpdate["data"] = {};
    if (row.malId === null) data.malId = entry.id;
    if (!row.studio?.trim() && entry.studio) data.studio = entry.studio;
    if (entry.episodes !== null && (row.episodes === null || entry.episodes > row.episodes)) {
      data.episodes = entry.episodes;
      data.status = deriveStatus(animeProgress({ episodesWatched: row.episodesWatched, episodes: entry.episodes }), WATCH_STATUS);
    }
    if (row.season === null && entry.season !== null) data.season = entry.season;
    if (row.year === null && entry.year !== null) data.year = entry.year;
    if (!row.coverImage && entry.poster) data.coverImage = entry.poster;

    let outcome: Outcome;
    let where: string | undefined;
    if (row.seriesId === series.id) {
      outcome = row.malId === null ? "linked" : "already";
    } else if (row.seriesId === null) {
      data.seriesId = series.id!;
      outcome = "moved";
    } else {
      outcome = "elsewhere";
      where = row.seriesName ?? "another series";
    }
    if (series.id && outcome !== "elsewhere" && row.seasonNumber === null) data.seasonNumber = ++next;

    if (Object.keys(data).length > 0) plan.update.push({ id: row.id, data });
    plan.report.push({ malId: entry.id, title: row.title, outcome, ...(where ? { where } : {}), animeId: row.id });
  }
  return plan;
}

/** Minutes watched: every episode watched × its length, once more for each rewatch. */
export function animeWatchedMinutes(
  rows: { episodesWatched: number; episodeDuration: number; timesRewatched: number }[],
): number {
  return rows.reduce((sum, a) => sum + a.episodesWatched * a.episodeDuration * (a.timesRewatched + 1), 0);
}
