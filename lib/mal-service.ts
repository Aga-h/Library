// Talking to MyAnimeList's official API (v2). Server-only: it reads MAL_CLIENT_ID, which must
// never reach a browser — the API license forbids sharing it. Pure rules live in lib/mal.ts.
//
// Only documented endpoints: /anime?q= and /manga?q= (search), /anime/{id} (one entry, with its
// related entries) and /manga/{id}. Public data needs only the Client ID, sent as X-MAL-CLIENT-ID —
// no user login.

import { byAiring, toEntry, type MalEntry } from "@/lib/mal";
import { toManga, type MalManga } from "@/lib/mal-manga";

/** Overridable so the importer can be tested against a local stand-in; production never sets it. */
const BASE_URL = (process.env.MAL_BASE_URL ?? "https://api.myanimelist.net/v2").replace(/\/$/, "");

/** How many entries one run may hold. Long-running franchises have ~20 seasons and films. */
export const MAX_RUN = 40;

/** Requests in flight at once. MyAnimeList does not publish a rate limit, so this stays gentle. */
const CONCURRENCY = 3;

const LIST_FIELDS = "id,title,main_picture,alternative_titles,start_date,media_type,num_episodes,status";
const DETAIL_FIELDS = `${LIST_FIELDS},start_season,average_episode_duration,studios,related_anime`;
const MANGA_FIELDS =
  "id,title,main_picture,alternative_titles,start_date,media_type,status,num_volumes,num_chapters,authors{first_name,last_name}";

export class MalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function clientId(): string {
  const id = process.env.MAL_CLIENT_ID?.trim();
  if (!id) throw new MalError("MyAnimeList isn't set up — add MAL_CLIENT_ID to the site's environment.", 503);
  return id;
}

type Raw = Record<string, unknown>;

async function get(path: string, params: Record<string, string>): Promise<Raw> {
  const id = clientId();
  const url = new URL(`${BASE_URL}${path}`);
  url.search = new URLSearchParams(params).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-MAL-CLIENT-ID": id, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new MalError("Couldn't reach MyAnimeList — try again in a minute.", 502);
  }

  if (res.status === 401 || res.status === 403) {
    throw new MalError("MyAnimeList refused the Client ID — check MAL_CLIENT_ID.", 502);
  }
  if (res.status === 404) throw new MalError("That isn't on MyAnimeList.", 404);
  if (res.status === 429) throw new MalError("MyAnimeList is rate-limiting requests — wait a moment and try again.", 429);
  const body = (await res.json().catch(() => null)) as Raw | null;
  if (res.status === 400) {
    throw new MalError(`MyAnimeList didn't accept that search${body?.message ? `: ${String(body.message)}` : "."}`, 400);
  }
  if (!res.ok || !body) throw new MalError(`MyAnimeList answered ${res.status}.`, 502);
  return body;
}

/** Entries matching a search, in MyAnimeList's relevance order. MAL wants at least 3 letters. */
export async function searchAnime(query: string): Promise<MalEntry[]> {
  const body = await get("/anime", { q: query, limit: "15", fields: LIST_FIELDS });
  const rows = Array.isArray(body.data) ? (body.data as Raw[]) : [];
  return rows.map((row) => toEntry(row?.node as Raw | undefined)).filter((e): e is MalEntry => e !== null);
}

async function entry(id: number): Promise<MalEntry> {
  const found = toEntry(await get(`/anime/${id}`, { fields: DETAIL_FIELDS }));
  if (!found) throw new MalError("MyAnimeList sent that entry without a title.", 502);
  return found;
}

/**
 * Each entry's details, a few at a time. One MyAnimeList cannot find is reported rather than
 * failing the batch — anything else (the Client ID, the rate limit) would fail every one of them.
 */
export async function entryDetails(
  ids: number[],
): Promise<{ entries: MalEntry[]; failed: { malId: number; reason: string }[] }> {
  const entries: MalEntry[] = [];
  const failed: { malId: number; reason: string }[] = [];
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        entries.push(await entry(id));
      } catch (e) {
        if (!(e instanceof MalError) || e.status !== 404) throw e;
        failed.push({ malId: id, reason: "not found on MyAnimeList" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return { entries: entries.sort(byAiring), failed };
}

/**
 * A whole run: the entry, and everything reachable from it through sequel and prequel links —
 * the main line, films included when MAL files them as sequels. Side stories, spin-offs and
 * recaps hang off other links and are left out. In watch order; at most MAX_RUN entries — for a
 * longer franchise, the ones nearest the entry picked, since the walk spreads out from it.
 */
export async function walkRun(startId: number): Promise<{ entries: MalEntry[]; truncated: boolean }> {
  const found = new Map<number, MalEntry>();
  // Every id asked for, found or not: a link to an entry MAL no longer has is tried once.
  const tried = new Set<number>([startId]);
  let frontier = [startId];
  let truncated = false;

  while (frontier.length > 0) {
    const room = MAX_RUN - found.size;
    if (frontier.length > room) {
      truncated = true;
      frontier = frontier.slice(0, room);
    }
    if (frontier.length === 0) break;
    const { entries } = await entryDetails(frontier);
    // The entry asked for must exist; a missing link further along is just skipped.
    if (found.size === 0 && entries.length === 0) throw new MalError("That isn't on MyAnimeList.", 404);
    const nextIds = new Set<number>();
    for (const e of entries) {
      found.set(e.id, e);
      for (const id of [...e.sequels, ...e.prequels]) if (!tried.has(id)) nextIds.add(id);
    }
    frontier = [...nextIds];
    for (const id of frontier) tried.add(id);
  }
  return { entries: [...found.values()].sort(byAiring), truncated };
}

/** Manga matching a search, in MyAnimeList's relevance order. MAL wants at least 3 letters. */
export async function searchManga(query: string): Promise<MalManga[]> {
  const body = await get("/manga", { q: query, limit: "15", fields: MANGA_FIELDS });
  const rows = Array.isArray(body.data) ? (body.data as Raw[]) : [];
  return rows.map((row) => toManga(row?.node as Raw | undefined)).filter((m): m is MalManga => m !== null);
}

/** One manga — the whole series, volumes and chapters counted inside it. */
export async function mangaEntry(id: number): Promise<MalManga> {
  const found = toManga(await get(`/manga/${id}`, { fields: MANGA_FIELDS }));
  if (!found) throw new MalError("MyAnimeList sent that manga without a title.", 502);
  return found;
}
