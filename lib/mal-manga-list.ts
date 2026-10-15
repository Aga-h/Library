// Importing a whole MyAnimeList manga list at once: reading it — a copy of the list page (.xlsx),
// MyAnimeList's own export (.xml), or a public user's list through the API — and deciding which
// lines come in. On MyAnimeList a manga is one entry for the whole series, so each line is one
// library row, imported through the ordinary manga import (lib/mal-manga-import.ts) as read.
//
// Pure, so the tests exercise every rule without a network or a database.

import { cleanTitle } from "@/lib/mal-list";
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
 * Rows from a copy of a MyAnimeList manga list page: the header row has "Manga Title" (or just
 * "Title") and "Type"; each title cell links to the manga's page, which gives its id.
 */
export function rowsFromMangaSheet(rows: readonly Cell[][], links: readonly (string | null)[][] = []): MangaListRow[] {
  const norm = (c: Cell | undefined) => String(c ?? "").trim().toLowerCase();
  const headerAt = rows.findIndex((r) => r.some((c) => /title$/.test(norm(c))) && r.some((c) => norm(c) === "type"));
  if (headerAt < 0) return [];
  const header = rows[headerAt].map(norm);
  const titleCol = header.findIndex((h) => h === "manga title" || h === "title");
  const typeCol = header.indexOf("type");
  if (titleCol < 0) return [];

  const out: Omit<MangaListRow, "key">[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const title = cleanTitle(rows[i][titleCol]);
    if (!title) continue;
    out.push({
      malId: mangaIdFromLink(links[i]?.[titleCol]),
      title,
      mediaType: mangaTypeKey(rows[i][typeCol]),
      status: null,
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
    });
  }
  return keyed(out);
}

/** True when this is an anime export rather than a manga one — easy to pick up by mistake. */
export function isAnimeExport(xml: string): boolean {
  return /<anime>/.test(xml) && !/<manga>/.test(xml);
}

/** Rows from the API's completed manga list (lib/mal-service.ts userCompletedManga). */
export function rowsFromApiManga(entries: readonly MalManga[]): MangaListRow[] {
  return keyed(entries.map((m) => ({
    malId: m.id,
    title: m.titleEn ?? m.title,
    mediaType: m.mediaType,
    status: "completed",
  })));
}

export type MangaLeftOut = "novel" | "not_completed";

export const MANGA_LEFT_OUT_LABELS: Record<MangaLeftOut, string> = {
  novel: "Light novels and novels — they belong under Books",
  not_completed: "Not on your Completed list",
};

/**
 * Why a line isn't imported, or null when it is: novels go under Books, and only what you have
 * finished is logged as read. Everything else — manga, manhwa, manhua, one-shots — comes in.
 */
export function mangaLeftOut(row: Pick<MangaListRow, "mediaType" | "status">): MangaLeftOut | null {
  if (NOVEL_MEDIA.has(row.mediaType)) return "novel";
  if (row.status !== null && row.status !== "completed") return "not_completed";
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
