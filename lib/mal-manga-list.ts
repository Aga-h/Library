// Importing a whole MyAnimeList manga list at once: reading it — a copy of the list page (.xlsx),
// MyAnimeList's own export (.xml), or a public user's list through the API — and deciding which
// lines come in. On MyAnimeList a manga is one entry for the whole series, so each line is one
// library row, imported through the ordinary manga import (lib/mal-manga-import.ts) as read.
//
// Pure, so the tests exercise every rule without a network or a database.

import { NOVEL_MEDIA, type MalManga } from "@/lib/mal-manga";
import { normaliseTitle } from "@/lib/tmdb";
import { decodeXml, type Cell } from "@/lib/xlsx-lite";

export interface MangaListRow {
  /** Unique within one list: "mal:{id}" when the id is known, else "row:{n}". */
  key: string;
  /** Known from the export, the API, or a list page's title link; null when only the title is. */
  malId: number | null;
  title: string;
  /** MyAnimeList's media type, lower case: manga, manhwa, manhua, one_shot, light_novel, novel, … */
  mediaType: string;
  /** "completed", "reading", … — null when the list doesn't say (a copy of one list page). */
  status: string | null;
  /** How far you are — for a finished one, its count on your list; null when the list doesn't say. */
  chaptersRead: number | null;
  volumesRead: number | null;
}

/** "Light Novel" → "light_novel", "One-shot" → "one_shot". */
export function mangaTypeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_") || "unknown";
}

/** A manga's MyAnimeList id from a link to its page: "https://myanimelist.net/manga/2/Berserk" → 2. */
export function mangaIdFromLink(link: string | null | undefined): number | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    if (!/(^|\.)myanimelist\.net$/.test(u.hostname)) return null;
    const id = Number(/^\/manga\/(\d+)(\/|$)/.exec(u.pathname)?.[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function keyed(rows: Omit<MangaListRow, "key">[], firstRow = 1): MangaListRow[] {
  const seen = new Set<string>();
  const out: MangaListRow[] = [];
  rows.forEach((r, i) => {
    const key = r.malId ? `mal:${r.malId}` : `row:${firstRow + i}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, ...r });
  });
  return out;
}

/**
 * A list page's title cell, cleaned: it also holds the "Add - More" (or "Edit - More") links and,
 * for a series not finished, its publishing state — "Blue Lock PublishingAdd - More" → "Blue Lock".
 */
export function cleanMangaTitle(value: unknown): string {
  return String(value ?? "").split("\n")[0]
    .replace(/\s*(Add|Edit)\s*-\s*More\s*$/i, "")
    .replace(/\s*(Publishing|On Hiatus|Discontinued|Not Yet Published)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countOf(value: string | undefined): number | null {
  const n = Number(value?.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * A list page's Chapters (or Volumes) cell. On an "All Manga" page a line you're reading shows
 * "read / total" ("189 / -") and a finished one just its count ("162", or "-" for a one-shot).
 */
export function progressCell(value: Cell | undefined): { read: number | null; reading: boolean } {
  const text = String(value ?? "").trim();
  if (text.includes("/")) return { read: countOf(text.split("/")[0]), reading: true };
  return { read: countOf(text), reading: false };
}

/**
 * Rows from a copy of a MyAnimeList manga list page — its Completed tab or "All Manga". The header
 * row has "Manga Title" (or just "Title"); "Type" is there on some layouts and not others. Each
 * title links to the manga's page, which gives its id. Where there is a Chapters column, "read /
 * total" marks one you're reading, at that chapter; a plain count, one you finished.
 */
export function rowsFromMangaSheet(rows: readonly Cell[][], links: readonly (string | null)[][] = []): MangaListRow[] {
  const norm = (c: Cell | undefined) => String(c ?? "").trim().toLowerCase();
  const headerAt = rows.findIndex((r) => r.some((c) => norm(c) === "manga title" || norm(c) === "title"));
  if (headerAt < 0) return [];
  const header = rows[headerAt].map(norm);
  const titleCol = header.findIndex((h) => h === "manga title" || h === "title");
  const typeCol = header.indexOf("type");
  const chaptersCol = header.indexOf("chapters");
  const volumesCol = header.indexOf("volumes");

  const out: Omit<MangaListRow, "key">[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const title = cleanMangaTitle(rows[i][titleCol]);
    // The page's footer ("MyAnimeList.net is a property of…") sits in the first column, not here.
    if (!title) continue;
    // The id: the title's link, else any cell holding the manga's address (the cover's link).
    const malId = mangaIdFromLink(links[i]?.[titleCol])
      ?? rows[i].map((c) => mangaIdFromLink(typeof c === "string" ? c : null)).find((id) => id !== null)
      ?? null;
    const chapters = chaptersCol >= 0 ? progressCell(rows[i][chaptersCol]) : null;
    const volumes = volumesCol >= 0 ? progressCell(rows[i][volumesCol]) : null;
    const reading = chapters?.reading ?? false;
    // A finished line shows its whole count ("162"); kept, for a series MyAnimeList calls running.
    out.push({
      malId,
      title,
      mediaType: typeCol >= 0 ? mangaTypeKey(rows[i][typeCol]) : "unknown",
      status: chapters ? (reading ? "reading" : "completed") : null,
      chaptersRead: chapters?.read ?? null,
      volumesRead: volumes?.read ?? null,
    });
  }
  return keyed(out, headerAt + 2);
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${name}>`).exec(block);
  return m ? (m[1] ?? decodeXml(m[2] ?? "")).trim() : "";
}

/** MyAnimeList's own manga list export (.xml): every entry, with its status. */
export function rowsFromMangaExport(xml: string): MangaListRow[] {
  const out: Omit<MangaListRow, "key">[] = [];
  for (const m of xml.matchAll(/<manga>([\s\S]*?)<\/manga>/g)) {
    const malId = Number(tag(m[1], "manga_mangadb_id"));
    const title = tag(m[1], "manga_title") || tag(m[1], "series_title");
    if (!Number.isInteger(malId) || malId <= 0 || !title) continue;
    out.push({
      malId,
      title,
      // The export doesn't say what kind each one is; MyAnimeList's details do, at import.
      mediaType: "unknown",
      status: tag(m[1], "my_status").toLowerCase().replace(/\s+/g, "_") || null,
      chaptersRead: Number(tag(m[1], "my_read_chapters")) || null,
      volumesRead: Number(tag(m[1], "my_read_volumes")) || null,
    });
  }
  return keyed(out);
}

/** True when this is an anime export rather than a manga one — easy to pick up by mistake. */
export function isAnimeExport(xml: string): boolean {
  return /<anime>/.test(xml) && !/<manga>/.test(xml);
}

/** A line of the API's manga list: the manga, and your status and progress on it. */
export interface ListedManga {
  manga: MalManga;
  status: string | null;
  chaptersRead: number | null;
  volumesRead: number | null;
}

/** Rows from the API's manga list (lib/mal-service.ts userMangaList). */
export function rowsFromApiManga(entries: readonly ListedManga[]): MangaListRow[] {
  return keyed(entries.map(({ manga: m, status, chaptersRead, volumesRead }) => ({
    malId: m.id,
    title: m.titleEn ?? m.title,
    mediaType: m.mediaType,
    status,
    chaptersRead,
    volumesRead,
  })));
}

export type MangaLeftOut = "novel" | "not_started";

export const MANGA_LEFT_OUT_LABELS: Record<MangaLeftOut, string> = {
  novel: "Light novels and novels — they belong under Books",
  not_started: "On hold, dropped or plan to read",
};

/**
 * Why a line isn't imported, or null when it is: novels go under Books; what you finished comes in
 * as read and what you're reading at your chapter — anything else (on hold, dropped, planned) stays
 * out. Manga, manhwa, manhua and one-shots all come in.
 */
export function mangaLeftOut(row: Pick<MangaListRow, "mediaType" | "status">): MangaLeftOut | null {
  if (NOVEL_MEDIA.has(row.mediaType)) return "novel";
  if (row.status !== null && row.status !== "completed" && row.status !== "reading") return "not_started";
  return null;
}

/**
 * The search result a title-only line is: one whose title (any of them) reads the same, preferring
 * the same type. No fuzzy guessing — a line with no exact match is reported as not found.
 */
export function pickManga(row: Pick<MangaListRow, "title" | "mediaType">, candidates: readonly MalManga[]): MalManga | null {
  const wanted = normaliseTitle(row.title);
  const named = candidates.filter((m) =>
    [m.title, m.titleEn, ...m.synonyms].some((t) => t && normaliseTitle(t) === wanted));
  return named.find((m) => m.mediaType === row.mediaType) ?? named[0] ?? null;
}
