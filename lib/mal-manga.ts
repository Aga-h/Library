// Importing manga from MyAnimeList: reading its answers, and the rules for landing an entry in the
// library. On MyAnimeList a manga is one entry for the whole series — volumes and chapters are
// counted inside it — so, unlike anime, there is no run of seasons to walk: one entry, one row.
//
// Pure and dependency-free, so the tests exercise every rule without a network or a database
// (scripts/test-mal-manga.mjs). The API client is lib/mal-service.ts; the database side is the
// /api/manga/mal routes. As with anime, only the official API is used, MyAnimeList is credited,
// and its content is not altered — titles and names are stored as it gives them.

import { malImage } from "@/lib/mal";
import { normaliseTitle } from "@/lib/tmdb";

export type MangaFormatValue = "MANGA" | "MANHWA" | "MANHUA";

export interface MalManga {
  id: number;
  /** MyAnimeList's main title — usually romaji ("Shingeki no Kyojin"). */
  title: string;
  /** Its English title, when it has one ("Attack on Titan"). */
  titleEn: string | null;
  synonyms: string[];
  year: number | null;
  /** "manga", "manhwa", "manhua", "one_shot", "light_novel", "novel", "doujinshi", "oel", … */
  mediaType: string;
  /** "finished", "currently_publishing", "on_hiatus", "not_yet_published", "discontinued". */
  publishing: string;
  /** null when MyAnimeList doesn't know (it sends 0 — always so while a series is running). */
  volumes: number | null;
  chapters: number | null;
  /** Who wrote it ("Story" or "Story & Art"), in MyAnimeList's order. */
  writers: string[];
  /** Who drew it, when that's someone else ("Art"). */
  artists: string[];
  cover: string | null;
}

type Raw = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** "Eiichiro" + "Oda" → "Eiichiro Oda". A one-name credit ("CLAMP") stays as it is. */
function personName(node: Raw | undefined): string {
  const first = text(node?.first_name);
  const last = text(node?.last_name);
  return [first, last].filter(Boolean).join(" ");
}

/** A manga entry as MyAnimeList's API sends it, or null if it's unusable (no id or no title). */
export function toManga(raw: Raw | undefined): MalManga | null {
  if (!raw) return null;
  const id = positiveInt(raw.id);
  const title = text(raw.title);
  if (!id || !title) return null;
  const alt = (raw.alternative_titles ?? {}) as Raw;
  const pictures = (raw.main_picture ?? {}) as Raw;
  const year = Number(text(raw.start_date).slice(0, 4));

  const writers: string[] = [];
  const artists: string[] = [];
  for (const credit of Array.isArray(raw.authors) ? (raw.authors as Raw[]) : []) {
    const name = personName(credit?.node as Raw | undefined);
    if (!name) continue;
    const role = text(credit?.role).toLowerCase();
    // "Story & Art" writes it; "Art" alone draws it; anything else ("Story", unknown) writes it.
    if (role === "art") artists.push(name);
    else writers.push(name);
  }

  return {
    id,
    title,
    titleEn: text(alt.en) || null,
    synonyms: Array.isArray(alt.synonyms) ? (alt.synonyms as unknown[]).map(text).filter(Boolean) : [],
    year: Number.isInteger(year) && year > 0 ? year : null,
    mediaType: text(raw.media_type) || "manga",
    publishing: text(raw.status) || "finished",
    volumes: positiveInt(raw.num_volumes),
    chapters: positiveInt(raw.num_chapters),
    writers,
    artists,
    cover: malImage(pictures.large) ?? malImage(pictures.medium),
  };
}

/**
 * Prose, not comics: MyAnimeList files light novels and novels under manga, but the library keeps
 * them with books — so they are listed in a search, and not imported here.
 */
export const NOVEL_MEDIA = new Set(["light_novel", "novel"]);

/** The library's format for a MyAnimeList media type — everything not Korean or Chinese is manga. */
export function formatOf(mediaType: string): MangaFormatValue {
  if (mediaType === "manhwa") return "MANHWA";
  if (mediaType === "manhua") return "MANHUA";
  return "MANGA";
}

/**
 * Still coming out, so there is no final count yet: publishing, paused, or announced. A finished or
 * a discontinued series has its last count.
 */
export function isOngoing(publishing: string): boolean {
  return publishing === "currently_publishing" || publishing === "on_hiatus" || publishing === "not_yet_published";
}

/** The title to store: the English one when asked for and there is one, else MyAnimeList's main. */
export function titleOf(m: Pick<MalManga, "title" | "titleEn">, english: boolean): string {
  return english && m.titleEn ? m.titleEn : m.title;
}

/** Author and artist columns. The author column is required, so an uncredited entry says so. */
export function creditsOf(m: Pick<MalManga, "writers" | "artists">): { author: string; artist: string | null } {
  const author = m.writers.join(", ") || m.artists.join(", ") || "Unknown";
  const artistNames = m.artists.filter((a) => !m.writers.includes(a));
  return { author, artist: m.writers.length > 0 && artistNames.length > 0 ? artistNames.join(", ") : null };
}

export interface NewMangaRow {
  malId: number;
  title: string;
  author: string;
  artist: string | null;
  format: MangaFormatValue;
  totalVolumes: number | null;
  totalChapters: number | null;
  volumesRead: number;
  chaptersRead: number;
  ongoing: boolean;
  coverImage: string | null;
}

/**
 * A new library row for a MyAnimeList manga. "Read it" only applies to a series with an end: it
 * marks every chapter and volume read. Status is left to deriveStatus, from these counts.
 */
export function rowFromManga(m: MalManga, { english, read }: { english: boolean; read: boolean }): NewMangaRow {
  const ongoing = isOngoing(m.publishing);
  const finishedRead = read && !ongoing;
  return {
    malId: m.id,
    title: titleOf(m, english),
    ...creditsOf(m),
    format: formatOf(m.mediaType),
    totalVolumes: m.volumes,
    totalChapters: m.chapters,
    volumesRead: finishedRead ? m.volumes ?? 0 : 0,
    chaptersRead: finishedRead ? m.chapters ?? 0 : 0,
    ongoing,
    coverImage: m.cover,
  };
}

export interface ExistingManga {
  id: string;
  title: string;
  malId: number | null;
}

/**
 * A manga already in the library that this entry is — by MyAnimeList id, or else a hand-added
 * one (no MyAnimeList link yet) whose title matches any of the entry's titles. Matching on the
 * normalised title means "Attack on titan" typed by hand is found by "Attack on Titan".
 */
export function matchExisting<T extends ExistingManga>(m: MalManga, library: readonly T[]): T | null {
  const linked = library.find((x) => x.malId === m.id);
  if (linked) return linked;
  const names = new Set([m.title, m.titleEn ?? "", ...m.synonyms].filter(Boolean).map(normaliseTitle));
  return library.find((x) => x.malId === null && names.has(normaliseTitle(x.title))) ?? null;
}

export interface MangaFields {
  author: string;
  artist: string | null;
  totalVolumes: number | null;
  totalChapters: number | null;
  ongoing: boolean;
  coverImage: string | null;
}

/**
 * What MyAnimeList may change on a manga already in the library — when linking a hand-added one,
 * or checking a linked one again. Only blanks are filled and counts only grow: your title,
 * progress, rating, notes, language and publisher are never touched. A series that has ended is
 * no longer "ongoing", so its final counts can apply.
 */
export function updatesFromManga(existing: MangaFields, m: MalManga): Partial<MangaFields> {
  const out: Partial<MangaFields> = {};
  const credits = creditsOf(m);
  if (!existing.author.trim() && credits.author !== "Unknown") out.author = credits.author;
  if (!existing.artist && credits.artist) out.artist = credits.artist;
  if (!existing.coverImage && m.cover) out.coverImage = m.cover;
  if (m.volumes !== null && (existing.totalVolumes ?? 0) < m.volumes) out.totalVolumes = m.volumes;
  if (m.chapters !== null && (existing.totalChapters ?? 0) < m.chapters) out.totalChapters = m.chapters;
  const ongoing = isOngoing(m.publishing);
  if (existing.ongoing !== ongoing) out.ongoing = ongoing;
  return out;
}
