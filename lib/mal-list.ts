// Importing a whole MyAnimeList list at once: which entries are seasons to log, and — for a list
// that arrives without MyAnimeList ids (a copy of the list page) — which search result each row is.
//
// "Seasons only": TV series and web series (ONA) with more than one episode. Films, OVAs, specials,
// TV specials and recaps, music videos and promos are left out, and so are web shorts (episodes
// under 10 minutes — the chibi spin-offs). TV keeps its short-episode seasons: some real seasons
// air as five-minute episodes. Everything left out is still listed, with why, to tick by hand.
//
// Pure, so scripts/test-mal-list.mjs covers every rule.

import { normaliseTitle } from "@/lib/tmdb";
import type { MalEntry } from "@/lib/mal";
import { decodeXml, type Cell } from "@/lib/xlsx-lite";

/** One row of a list, however it arrived. */
export interface ListRow {
  /** Known from MyAnimeList's own export; null for a copied list page. */
  malId: number | null;
  title: string;
  /** MyAnimeList's media type, lower case: tv, movie, ova, ona, special, tv_special, music, pv, cm. */
  mediaType: string;
  episodes: number | null;
  /** Your score, 1–10; null when not scored. */
  score: number | null;
}

const TYPES: Record<string, string> = {
  tv: "tv", movie: "movie", ova: "ova", ona: "ona", special: "special", "tv special": "tv_special",
  tv_special: "tv_special", music: "music", pv: "pv", cm: "cm",
};

/** "TV Special" → "tv_special"; anything unknown → "unknown". */
export function typeKey(value: unknown): string {
  return TYPES[String(value ?? "").trim().toLowerCase()] ?? "unknown";
}

function count(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function score(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

export const MIN_SHORT_MINUTES = 10;

export type LeftOut = "movie" | "ova" | "special" | "tv_special" | "music" | "promo" | "short" | "one_episode" | "other";

export const LEFT_OUT_LABELS: Record<LeftOut, string> = {
  movie: "Films",
  ova: "OVAs",
  special: "Specials",
  tv_special: "TV specials and recaps",
  music: "Music videos",
  promo: "Promos and ads",
  short: "Web shorts (episodes under 10 minutes)",
  one_episode: "One-offs (a single episode)",
  other: "Other",
};

/** null: a season, to import. Otherwise why it is left out. `duration` is minutes per episode. */
export function leftOutReason(e: { mediaType: string; episodes: number | null; duration?: number | null }): LeftOut | null {
  switch (e.mediaType) {
    case "tv": case "ona": break;
    case "movie": return "movie";
    case "ova": return "ova";
    case "special": return "special";
    case "tv_special": return "tv_special";
    case "music": return "music";
    case "pv": case "cm": return "promo";
    default: return "other";
  }
  if (e.episodes !== null && e.episodes < 2) return "one_episode";
  if (e.mediaType === "ona" && e.duration != null && e.duration < MIN_SHORT_MINUTES) return "short";
  return null;
}

/** The title cell of a copied list page: the title, without the page's "Add - More" links. */
export function cleanTitle(value: unknown): string {
  return String(value ?? "").split("\n")[0].replace(/\s*Add\s*-\s*More\s*$/i, "").trim();
}

/**
 * Rows of a copied MyAnimeList list page (as a spreadsheet): found under the header row that names
 * "Anime Title" and "Type"; progress is the episode count, score "-" is none.
 */
export function rowsFromSheet(rows: readonly Cell[][]): ListRow[] {
  const norm = (c: Cell) => String(c ?? "").trim().toLowerCase();
  const headerAt = rows.findIndex((r) => r.some((c) => norm(c) === "anime title") && r.some((c) => norm(c) === "type"));
  if (headerAt < 0) return [];
  const header = rows[headerAt].map(norm);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const titleCol = col("anime title");
  const typeCol = col("type");
  const epsCol = col("progress", "episodes", "eps");
  const scoreCol = col("score");

  const out: ListRow[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const title = cleanTitle(r[titleCol]);
    const mediaType = typeKey(r[typeCol]);
    if (!title || mediaType === "unknown") continue;
    out.push({
      malId: null,
      title,
      mediaType,
      episodes: epsCol >= 0 ? count(r[epsCol]) : null,
      score: scoreCol >= 0 ? score(r[scoreCol]) : null,
    });
  }
  return out;
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${name}>`).exec(block);
  return m ? (m[1] ?? decodeXml(m[2] ?? "")).trim() : "";
}

/** MyAnimeList's own list export (Profile → Export, .xml): the entries with this status. */
export function rowsFromMalExport(xml: string, status = "Completed"): ListRow[] {
  const out: ListRow[] = [];
  for (const m of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const b = m[1];
    if (tag(b, "my_status").toLowerCase() !== status.toLowerCase()) continue;
    const title = tag(b, "series_title");
    const malId = count(tag(b, "series_animedb_id"));
    if (!title || !malId) continue;
    out.push({
      malId,
      title,
      mediaType: typeKey(tag(b, "series_type")),
      episodes: count(tag(b, "series_episodes")),
      score: score(tag(b, "my_score")),
    });
  }
  return out;
}

/** What to search MyAnimeList for: the title, cut at a word under 64 characters. */
export function searchQuery(title: string): string {
  if (title.length <= 64) return title;
  const cut = title.slice(0, 64);
  return cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : 64).trim();
}

/**
 * Which search result a list row is. By id when the row has one. Otherwise the title must match
 * one of the entry's titles exactly (ignoring case and punctuation), and the type and episode
 * count decide between same-named entries — "Hunter x Hunter" is two entries, 62 and 148
 * episodes. A row that still matches more than one entry, or none, is left for you to add.
 */
export function pickEntry(row: ListRow, candidates: readonly MalEntry[]): MalEntry | null {
  if (row.malId !== null) return candidates.find((c) => c.id === row.malId) ?? null;
  const want = normaliseTitle(row.title);
  const named = candidates.filter((c) =>
    [c.title, c.titleEn ?? "", ...c.synonyms].some((t) => t && normaliseTitle(t) === want));
  const sameType = named.filter((c) => c.mediaType === row.mediaType);
  const sameCount = (c: MalEntry) => row.episodes !== null && c.episodes === row.episodes;
  for (const pool of [sameType.filter(sameCount), sameType, named.filter(sameCount)]) {
    if (pool.length === 1) return pool[0];
    if (pool.length > 1) return null;
  }
  return null;
}
