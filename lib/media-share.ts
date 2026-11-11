// Sending media to a friend's site and back: what an item carries, how long the receiver gets
// for it, and the checks on what the other site sends. Pure — the network and the database are in
// lib/media-share-service.ts, and the wire format is written up in docs/media-exchange.md.
//
// One item is open each way at a time: you send something, and can send the next once they mark
// it finished. The receiver's deadline is worked out on the receiving site, from the item's length.

import { z } from "zod";
import type { TmdbDetails } from "@/lib/tmdb";
import type { TmdbShowDetails } from "@/lib/tmdb-tv";
import type { MalEntry } from "@/lib/mal";
import type { MalManga } from "@/lib/mal-manga";
import type { CatalogBook } from "@/lib/openlibrary";
import { isTmdbImage } from "@/lib/tmdb";
import { isMalImage } from "@/lib/mal";
import { isGoogleBooksImage } from "@/lib/google-books";

export const SHARE_KINDS = ["movie", "tv", "anime", "manga", "book"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const KIND_LABEL: Record<ShareKind, string> = {
  movie: "Movie",
  tv: "TV",
  anime: "Anime",
  manga: "Manga",
  book: "Book",
};

/** Which catalogue each kind is searched in — shown beside the search box. */
export const KIND_SOURCE: Record<ShareKind, string> = {
  movie: "TMDB",
  tv: "TMDB",
  anime: "MyAnimeList",
  manga: "MyAnimeList",
  book: "Google Books",
};

export const NOTE_MAX = 500;

export const SHARE_NOT_READY = "The media exchange starts once 042-media-shares.sql has run in Supabase.";

/** An item as both sites hold it: everything shown on the card. */
export interface ShareMedia {
  kind: ShareKind;
  /** The catalogue's id: TMDB or MyAnimeList's number, or the Google Books volume id. */
  sourceId: string;
  title: string;
  /** The English title, when the main one is romaji. */
  altTitle: string | null;
  year: number | null;
  image: string | null;
  /** Director, creator, studio or author. */
  creator: string | null;
  /** Short lines under the title: "Studio Ghibli", "HBO", "Penguin". */
  facts: string[];
  /** How long it takes to get through, in minutes; null when the catalogue doesn't say. */
  lengthMinutes: number | null;
  /** The length as the catalogue counts it: "2h 5m", "3 seasons · 30 episodes", "320 pages". */
  lengthLabel: string | null;
}

// ─── How long things take ────────────────────────────────────────────────────

/** A manga chapter, read. */
export const CHAPTER_MINUTES = 5;
/** A volume, when only volumes are counted (about nine chapters). */
export const VOLUME_MINUTES = 45;
/** A page of a book: about 40 pages an hour. */
export const PAGE_MINUTES = 1.5;

/**
 * Days the receiver gets: three days per hour of it, rounded up by the hour, so a two-hour film is
 * six days (asked for 2026-11-11: three times the first rule, an hour a day). Never under 6 (a
 * short film still needs evenings that suit), never over 180 (a 1,000-episode run isn't a
 * deadline anyone keeps), and three weeks when the length isn't known.
 */
export const DAYS_PER_HOUR = 3;
export const MIN_DAYS = 6;
export const MAX_DAYS = 180;
export const UNKNOWN_DAYS = 21;

/** More open than this each way is refused — a guard against a runaway sender, not a rule. */
export const MAX_OPEN = 50;

export function allowanceDays(lengthMinutes: number | null): number {
  if (lengthMinutes === null || !Number.isFinite(lengthMinutes) || lengthMinutes <= 0) return UNKNOWN_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.ceil(lengthMinutes / 60) * DAYS_PER_HOUR));
}

/** When the receiver should be done by, counted from when it arrived. */
export function dueFrom(received: Date, lengthMinutes: number | null): Date {
  return new Date(received.getTime() + allowanceDays(lengthMinutes) * 24 * 60 * 60 * 1000);
}

/** "2h 5m", "45m", "3h". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/**
 * What's left, for the timer: "1d 4h left", "3h 20m left", "5m left", or "2d 1h late". Under a
 * day it counts minutes, since that's when they matter.
 */
export function timeLeft(due: Date, now: Date): { late: boolean; text: string } {
  const diff = due.getTime() - now.getTime();
  const late = diff < 0;
  const total = Math.floor(Math.abs(diff) / 60_000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { late, text: late ? `${span} late` : `${span} left` };
}

/** How much of the allowance is used, 0–1, for the bar under the timer. */
export function elapsedShare(sent: Date, due: Date, now: Date): number {
  const span = due.getTime() - sent.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - sent.getTime()) / span));
}

// ─── From each catalogue ─────────────────────────────────────────────────────

function positive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function fromFilm(d: TmdbDetails): ShareMedia {
  return {
    kind: "movie",
    sourceId: String(d.id),
    title: d.title,
    altTitle: null,
    year: d.year,
    image: d.poster,
    creator: d.director,
    facts: d.studio ? [d.studio] : [],
    lengthMinutes: positive(d.runtime) ? d.runtime : null,
    lengthLabel: positive(d.runtime) ? formatMinutes(d.runtime) : null,
  };
}

/** The whole show: every numbered season's episodes, at the season's runtime or the show's. */
export function fromShow(d: TmdbShowDetails): ShareMedia {
  let episodes = 0;
  let minutes = 0;
  for (const s of d.seasons) {
    const count = s.episodeCount ?? 0;
    episodes += count;
    minutes += count * (s.runtime ?? d.runtime);
  }
  const label = episodes > 0
    ? `${plural(d.seasons.length, "season")} · ${plural(episodes, "episode")}`
    : null;
  return {
    kind: "tv",
    sourceId: String(d.id),
    title: d.name,
    altTitle: null,
    year: d.year,
    image: d.poster,
    creator: d.creator,
    facts: d.network ? [d.network] : [],
    lengthMinutes: minutes > 0 ? minutes : null,
    lengthLabel: label,
  };
}

const ANIME_TYPES: Record<string, string> = {
  tv: "TV", movie: "Movie", ova: "OVA", ona: "ONA", special: "Special", music: "Music", tv_special: "TV special",
};

export function fromAnime(e: MalEntry): ShareMedia {
  const eps = positive(e.episodes) ? e.episodes : null;
  const each = positive(e.duration) ? e.duration : null;
  const minutes = eps !== null && each !== null ? eps * each : null;
  let label: string | null = null;
  if (eps === 1 && each !== null) label = formatMinutes(each);
  else if (eps !== null) label = each !== null ? `${plural(eps, "episode")} × ${formatMinutes(each)}` : plural(eps, "episode");
  const kind = ANIME_TYPES[e.mediaType];
  return {
    kind: "anime",
    sourceId: String(e.id),
    title: e.title,
    altTitle: e.titleEn && e.titleEn !== e.title ? e.titleEn : null,
    year: e.year,
    image: e.poster,
    creator: e.studio,
    facts: [kind, e.airing === "airing" ? "Still airing" : null].filter((f): f is string => !!f),
    lengthMinutes: minutes,
    lengthLabel: label,
  };
}

export function fromManga(m: MalManga): ShareMedia {
  const chapters = positive(m.chapters) ? m.chapters : null;
  const volumes = positive(m.volumes) ? m.volumes : null;
  const minutes = chapters !== null ? chapters * CHAPTER_MINUTES : volumes !== null ? volumes * VOLUME_MINUTES : null;
  const parts = [volumes !== null ? plural(volumes, "volume") : null, chapters !== null ? plural(chapters, "chapter") : null]
    .filter((p): p is string => !!p);
  const people = [...new Set([...m.writers, ...m.artists])];
  return {
    kind: "manga",
    sourceId: String(m.id),
    title: m.title,
    altTitle: m.titleEn && m.titleEn !== m.title ? m.titleEn : null,
    year: m.year,
    image: m.cover,
    creator: people.length ? people.join(", ") : null,
    facts: m.publishing === "currently_publishing" ? ["Still publishing"] : [],
    lengthMinutes: minutes,
    lengthLabel: parts.length ? parts.join(" · ") : null,
  };
}

export function fromBook(b: CatalogBook): ShareMedia {
  const pages = positive(b.pages) ? b.pages : null;
  return {
    kind: "book",
    sourceId: b.googleBooksId ?? b.id,
    title: b.title,
    altTitle: null,
    year: b.year,
    image: b.cover,
    creator: b.author || null,
    facts: b.publisher ? [b.publisher] : [],
    lengthMinutes: pages !== null ? Math.round(pages * PAGE_MINUTES) : null,
    lengthLabel: pages !== null ? plural(pages, "page") : null,
  };
}

// ─── Links and ids ───────────────────────────────────────────────────────────

const NUMERIC_ID = /^[1-9]\d{0,9}$/;
const BOOK_ID = /^[A-Za-z0-9_-]{4,40}$/;

/** Whether a catalogue id is the shape its kind's catalogue uses. */
export function isSourceId(kind: ShareKind, id: string): boolean {
  return kind === "book" ? BOOK_ID.test(id) : NUMERIC_ID.test(id);
}

/** The item's page on its catalogue. Built here, never taken from the other site. */
export function sourceLink(kind: ShareKind, id: string): string | null {
  if (!isSourceId(kind, id)) return null;
  switch (kind) {
    case "movie": return `https://www.themoviedb.org/movie/${id}`;
    case "tv": return `https://www.themoviedb.org/tv/${id}`;
    case "anime": return `https://myanimelist.net/anime/${id}`;
    case "manga": return `https://myanimelist.net/manga/${id}`;
    case "book": return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
  }
}

/** Only https covers from the three catalogues' own image hosts are shown. */
export function isShareImage(src: string): boolean {
  try {
    if (new URL(src).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return isTmdbImage(src) || isMalImage(src) || isGoogleBooksImage(src);
}

// ─── What the other site sends ───────────────────────────────────────────────

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const shareMediaSchema = z
  .object({
    kind: z.enum(SHARE_KINDS),
    sourceId: z.string().max(40),
    title: shortText(300),
    altTitle: shortText(300).nullable(),
    year: z.number().int().min(1000).max(3000).nullable(),
    image: z.string().max(1000).nullable(),
    creator: shortText(300).nullable(),
    facts: z.array(shortText(120)).max(6),
    lengthMinutes: z.number().int().positive().max(1_000_000).nullable(),
    lengthLabel: shortText(120).nullable(),
  })
  .refine((m) => isSourceId(m.kind, m.sourceId), { message: "Bad catalogue id", path: ["sourceId"] })
  // A cover from anywhere else is dropped rather than refusing the item.
  .transform((m) => ({ ...m, image: m.image && isShareImage(m.image) ? m.image : null }));

/** `POST /api/exchange/inbox` — something sent from the friend's site. */
export const inboxSchema = z.object({
  id: z.uuid(),
  sentAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(NOTE_MAX).nullable(),
  media: shareMediaSchema,
});
export type InboxBody = z.infer<typeof inboxSchema>;

/** `POST /api/exchange/send` — from the portal's send sheet. */
export const sendSchema = z.object({
  kind: z.enum(SHARE_KINDS),
  sourceId: z.string().trim().max(40),
  note: z.string().trim().max(NOTE_MAX).optional().nullable(),
});

/** The friend's site's address: https, or http only for a site on this machine (testing). */
export function friendBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}
