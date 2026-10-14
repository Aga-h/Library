// Importing a whole MyAnimeList list at once: reading it (from a MyAnimeList username, MAL's own
// export, or a spreadsheet copy of a list page), deciding which entries are seasons, and grouping
// the seasons into series. The seasons then go through the ordinary run import (lib/mal-import.ts)
// one series at a time, as watched.
//
// Pure, so the tests can exercise every rule without a network or a database.

import { normaliseTitle } from "@/lib/tmdb";
import { byAiring, type MalEntry } from "@/lib/mal";
import type { Sheet } from "@/lib/xlsx-lite";

/** One line of a list, as the list gives it. */
export interface ListRow {
  /** Unique within one list: its MAL id when known, else its line number. */
  key: string;
  title: string;
  malId: number | null;
  /** MAL's media type: "tv", "ona", "movie", "ova", "special", "tv_special", "music", "pv", "cm". */
  mediaType: string;
  /** Episodes the entry has, when the list says. */
  episodes: number | null;
  /** Episodes watched, when the list says. */
  watched: number | null;
  /** "completed", "watching", … — null when the list does not say (a copy of one list page). */
  status: string | null;
}

/** What a season is: a TV or web series. Films, OVAs, specials, recaps, music videos are not. */
export const SEASON_MEDIA = new Set(["tv", "ona"]);

/** Below this a TV/web series is a set of shorts — "AkaKill! Theater", 24 × 2 min. */
export const MIN_SEASON_MINUTES = 60;

const MEDIA_NAMES: Record<string, string> = {
  movie: "a film", ova: "an OVA", special: "a special", tv_special: "a TV special", music: "a music video",
  pv: "a promo", cm: "an ad",
};

/** "TV", "TV Special", "Movie" (a list page or MAL's export) → MAL's API name. */
export function mediaTypeOf(value: string): string {
  const t = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t === "unknown" || t === "" ? "unknown" : t;
}

function count(value: unknown): number | null {
  const n = Number(typeof value === "string" ? value.trim() : value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** An anime's MAL id from a link to its page: "https://myanimelist.net/anime/5114/…" → 5114. */
export function malIdFromLink(link: string | null): number | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (!/(^|\.)myanimelist\.net$/.test(u.hostname)) return null;
    return count(u.pathname.match(/^\/anime\/(\d+)(\/|$)/)?.[1]);
  } catch {
    return null;
  }
}

/** A list page's title cell also holds its "Add - More" links: "Akame ga Kill! \nAdd - More". */
function cleanTitle(text: string): string {
  return text.split("\n")[0].replace(/\s+/g, " ").trim();
}

/**
 * Rows from a spreadsheet copy of a MyAnimeList list page: the header row is found by its
 * "Anime Title" and "Type" columns; each title cell links to the anime's page, which gives its id.
 * "Progress" is episodes watched — on a completed list, also how many it has.
 */
export function rowsFromSheet(sheet: Sheet): ListRow[] {
  const header = sheet.findIndex((row) => {
    const names = row.map((c) => c.text.trim().toLowerCase());
    return names.some((n) => n.includes("title")) && names.includes("type");
  });
  if (header < 0) throw new Error("No list in that file — it needs a header row with \"Anime Title\" and \"Type\".");
  const names = sheet[header].map((c) => c.text.trim().toLowerCase());
  const col = {
    title: names.findIndex((n) => n.includes("title")),
    type: names.indexOf("type"),
    progress: names.findIndex((n) => n === "progress" || n === "episodes" || n === "eps"),
  };

  const rows: ListRow[] = [];
  const keys = new Set<string>();
  for (let r = header + 1; r < sheet.length; r++) {
    const cells = sheet[r];
    const title = cleanTitle(cells[col.title]?.text ?? "");
    if (!title) continue;
    const malId = malIdFromLink(cells[col.title]?.link ?? null);
    const key = malId ? String(malId) : `row ${r + 1}`;
    if (keys.has(key)) continue;
    keys.add(key);
    const progress = col.progress >= 0 ? progressOf(cells[col.progress]?.text ?? "") : { watched: null, episodes: null };
    rows.push({ key, title, malId, mediaType: mediaTypeOf(cells[col.type]?.text ?? ""), status: null, ...progress });
  }
  return rows;
}

/** "24", "12 / 24" or "12/-" (a list page's Progress column). */
function progressOf(text: string): { watched: number | null; episodes: number | null } {
  const [a, b] = text.split("/").map((s) => s.trim());
  const watched = count(a);
  return { watched, episodes: b === undefined ? watched : count(b) };
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
  return m ? decodeEntities(m[1]).trim() : "";
}

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(Number(e.slice(1))) : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e]!);
}

/** Rows from MyAnimeList's own export (myanimelist.net/panel.php?go=export), unzipped. */
export function rowsFromMalXml(xml: string): ListRow[] {
  if (!/<myanimelist>/.test(xml)) throw new Error("That isn't a MyAnimeList export.");
  const rows: ListRow[] = [];
  for (const m of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const malId = count(tag(m[1], "series_animedb_id"));
    const title = tag(m[1], "series_title");
    if (!malId || !title) continue;
    rows.push({
      key: String(malId),
      title,
      malId,
      mediaType: mediaTypeOf(tag(m[1], "series_type")),
      episodes: count(tag(m[1], "series_episodes")),
      watched: count(tag(m[1], "my_watched_episodes")),
      status: tag(m[1], "my_status").toLowerCase().replace(/\s+/g, "_") || null,
    });
  }
  return rows;
}

type Raw = Record<string, unknown>;

/** Rows from the API's /users/{name}/animelist answer (one page of it). */
export function rowsFromApiList(body: Raw): ListRow[] {
  const rows: ListRow[] = [];
  for (const item of Array.isArray(body.data) ? (body.data as Raw[]) : []) {
    const node = (item?.node as Raw | undefined) ?? {};
    const listStatus = (item?.list_status as Raw | undefined) ?? {};
    const malId = count(node.id);
    const title = typeof node.title === "string" ? node.title.trim() : "";
    if (!malId || !title) continue;
    const alt = (node.alternative_titles as Raw | undefined) ?? {};
    rows.push({
      key: String(malId),
      title: typeof alt.en === "string" && alt.en.trim() ? alt.en.trim() : title,
      malId,
      mediaType: mediaTypeOf(typeof node.media_type === "string" ? node.media_type : ""),
      episodes: count(node.num_episodes),
      watched: count(listStatus.num_episodes_watched),
      status: typeof listStatus.status === "string" ? listStatus.status : null,
    });
  }
  return rows;
}

// ─── Which entries are seasons ───────────────────────────────────────────────

const RECAP = /\b(recaps?|picture drama|digest)\b/i;

/**
 * Why a list line is not a complete season, or null when it is one. From the list alone — before
 * asking MyAnimeList — so films and the like cost no request.
 */
export function leftOutByList(row: ListRow): string | null {
  if (row.status !== null && row.status !== "completed") return "not on your Completed list";
  if (row.mediaType !== "unknown" && !SEASON_MEDIA.has(row.mediaType)) return MEDIA_NAMES[row.mediaType] ?? `a ${row.mediaType}`;
  if (RECAP.test(row.title)) return "a recap";
  if (row.episodes !== null && row.episodes < 2) return "a single episode";
  if (row.episodes !== null && row.watched !== null && row.watched < row.episodes) {
    return `not finished (${row.watched} of ${row.episodes})`;
  }
  return null;
}

/** The same question once MyAnimeList's own details are in: its type, count, length, airing. */
export function leftOutByEntry(entry: MalEntry, row: ListRow | null): string | null {
  if (!SEASON_MEDIA.has(entry.mediaType)) return MEDIA_NAMES[entry.mediaType] ?? `a ${entry.mediaType}`;
  if (RECAP.test(entry.title) || (entry.titleEn !== null && RECAP.test(entry.titleEn))) return "a recap";
  if (entry.airing !== "finished") return entry.airing === "airing" ? "still airing" : "not aired yet";
  if (entry.episodes !== null && entry.episodes < 2) return "a single episode";
  if (entry.episodes !== null && entry.duration !== null && entry.episodes * entry.duration < MIN_SEASON_MINUTES) {
    return `shorts (${entry.episodes} × ${entry.duration} min)`;
  }
  if (row?.watched != null && entry.episodes !== null && row.watched < entry.episodes) {
    return `not finished (${row.watched} of ${entry.episodes})`;
  }
  return null;
}

// ─── Finding a line without an id ────────────────────────────────────────────

/**
 * The search result a title-only line is: one whose title (any of them) reads the same, preferring
 * the same type and episode count; else — marked a guess — the top result with the same type and
 * episode count. Null when nothing fits.
 */
export function pickMatch(row: ListRow, candidates: MalEntry[]): { entry: MalEntry; guessed: boolean } | null {
  const wanted = normaliseTitle(row.title);
  const sameKind = (e: MalEntry) =>
    (row.mediaType === "unknown" || e.mediaType === row.mediaType) && (row.episodes === null || e.episodes === row.episodes);
  const named = candidates.filter((e) =>
    [e.title, e.titleEn, ...e.synonyms].some((t) => t && normaliseTitle(t) === wanted));
  const exact = named.find(sameKind) ?? named[0];
  if (exact) return { entry: exact, guessed: false };
  const guess = row.episodes !== null && row.mediaType !== "unknown" ? candidates.find(sameKind) : undefined;
  return guess ? { entry: guess, guessed: true } : null;
}

/** MyAnimeList search wants a short query: the title cut at a word, at most 60 characters. */
export function searchQuery(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= 60) return t;
  const cut = t.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : 60);
}

// ─── Grouping seasons into series ────────────────────────────────────────────

/**
 * The seasons, grouped into series: two are in one series when a sequel/prequel link joins them —
 * directly, or through one entry not being imported (a film between two seasons). Each series in
 * watch order, the series by their first season's start.
 */
export function groupSeries(seasons: MalEntry[], bridges: MalEntry[]): MalEntry[][] {
  const parent = new Map<number, number>();
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const known = new Map<number, MalEntry>();
  for (const e of [...seasons, ...bridges]) if (!known.has(e.id)) known.set(e.id, e);
  for (const id of known.keys()) parent.set(id, id);

  const join = (a: number, b: number) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const seasonIds = new Set(seasons.map((s) => s.id));
  for (const e of known.values()) {
    // A bridge joins what it links to, but two bridges are never chained — one step only.
    for (const other of [...e.sequels, ...e.prequels]) {
      if (seasonIds.has(e.id) || seasonIds.has(other)) join(e.id, other);
    }
  }

  const groups = new Map<number, MalEntry[]>();
  for (const s of new Map(seasons.map((e) => [e.id, e])).values()) {
    const root = find(s.id);
    groups.set(root, [...(groups.get(root) ?? []), s]);
  }
  return [...groups.values()].map((g) => g.sort(byAiring)).sort((a, b) => byAiring(a[0], b[0]));
}

/** Ids a set of seasons links to that are not among them — fetched once, to bridge series. */
export function bridgeIds(seasons: MalEntry[], have: Set<number>): number[] {
  const out = new Set<number>();
  for (const s of seasons) for (const id of [...s.sequels, ...s.prequels]) if (!have.has(id)) out.add(id);
  return [...out];
}
