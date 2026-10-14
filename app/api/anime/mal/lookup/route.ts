import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { pickMatch, searchQuery } from "@/lib/mal-list";
import type { MalEntry } from "@/lib/mal";
import { MalError, entryDetails, searchAnime } from "@/lib/mal-service";
import { libraryAnimePlaces } from "@/lib/mal-import";

export const maxDuration = 60;

const schema = z.object({
  /** List lines to find: by id, or by title when the list gave none. */
  rows: z.array(z.object({
    key: z.string().min(1).max(40),
    title: z.string().min(1).max(300),
    malId: z.number().int().positive().nullable(),
    mediaType: z.string().max(20),
    episodes: z.number().int().positive().nullable(),
    watched: z.number().int().positive().nullable(),
    status: z.string().max(30).nullable(),
  })).max(15),
  /** Entries wanted only for their links — to tell which seasons are one series. */
  ids: z.array(z.number().int().positive()).max(30).default([]),
});

/**
 * One batch of a list import: MyAnimeList's details for each line (length, airing, links), with
 * where each already is in the library. Batches keep each request well inside the time limit.
 */
async function POSTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { rows, ids } = parsed.data;

  try {
    const missing: { key: string; reason: string }[] = [];
    const idFor = new Map<string, { malId: number; guessed: boolean }>();
    for (const row of rows) {
      if (row.malId) {
        idFor.set(row.key, { malId: row.malId, guessed: false });
        continue;
      }
      const query = searchQuery(row.title);
      const hit = query.length >= 3 ? pickMatch(row, await searchAnime(query, { nsfw: true })) : null;
      if (hit) idFor.set(row.key, { malId: hit.entry.id, guessed: hit.guessed });
      else missing.push({ key: row.key, reason: "not found on MyAnimeList" });
    }

    const wanted = [...new Set([...[...idFor.values()].map((v) => v.malId), ...ids])];
    const { entries, failed } = await entryDetails(wanted);
    const byId = new Map<number, MalEntry>(entries.map((e) => [e.id, e]));
    const places = await libraryAnimePlaces([...idFor.values()].map((v) => v.malId));

    const found = [];
    for (const [key, { malId, guessed }] of idFor) {
      const entry = byId.get(malId);
      if (!entry) {
        missing.push({ key, reason: failed.find((f) => f.malId === malId)?.reason ?? "not found on MyAnimeList" });
        continue;
      }
      found.push({ key, entry, guessed, place: places.get(malId) ?? null });
    }
    return NextResponse.json({ found, missing, bridges: ids.map((id) => byId.get(id)).filter(Boolean) });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
