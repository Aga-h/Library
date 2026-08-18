import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";

export const maxDuration = 300;

const BATCH_SIZE = 5;

async function fetchResilient(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      if (res.ok || ![408, 429, 500, 502, 503, 504].includes(res.status)) return res;
      const retryAfter = res.headers.get("retry-after");
      const backoff = retryAfter
        ? Number(retryAfter) * 1_000
        : Math.min(10_000, 500 * 2 ** (attempt - 1) + Math.random() * 500);
      if (attempt < retries) await new Promise(r => setTimeout(r, backoff));
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, Math.min(10_000, 500 * 2 ** (attempt - 1) + Math.random() * 500)));
    }
  }
  throw new Error(`All ${retries} attempts failed: ${url}`);
}

// Games to permanently exclude from the library. Matched against Steam's
// game name (exact, case-sensitive) so the entry is deleted from the DB and
// never re-created on future syncs.
const BLOCKED_STEAM_GAME_NAMES = new Set([
  "Dungeon Baller Playtest",
  "FINAL FANTASY VII", // plain re-release, not the 2013 version
]);

const OwnedGamesSchema = z.object({
  response: z.object({
    games: z.array(z.object({
      appid: z.number(),
      name: z.string(),
      playtime_forever: z.number(),
    })).optional(),
  }),
});

const AppDetailsSchema = z.record(z.string(), z.object({
  success: z.boolean(),
  data: z.object({
    developers: z.array(z.string()).optional(),
    publishers: z.array(z.string()).optional(),
  }).optional(),
}));

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

interface AchievementResult {
  unlocked: number;
  total: number;
}

interface StoreDetails {
  developer: string | null;
  publisher: string | null;
}

async function fetchOwnedGames(apiKey: string, steamId: string): Promise<SteamGame[]> {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;
  const res = await fetchResilient(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
  const parsed = OwnedGamesSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`Unexpected Steam API response shape: ${parsed.error.message}`);
  return parsed.data.response.games ?? [];
}

async function fetchAchievements(apiKey: string, steamId: string, appid: number): Promise<AchievementResult | null> {
  try {
    const url =
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
      `?key=${apiKey}&steamid=${steamId}&appid=${appid}&format=json`;
    const res = await fetchResilient(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const achievements: { achieved: number }[] = data.playerstats?.achievements ?? [];
    if (achievements.length === 0) return null;
    const unlocked = achievements.filter(a => a.achieved === 1).length;
    return { unlocked, total: achievements.length };
  } catch {
    return null;
  }
}

async function fetchStoreDetails(appid: number): Promise<StoreDetails> {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`;
    const res = await fetchResilient(url, { cache: "no-store" });
    if (!res.ok) return { developer: null, publisher: null };
    const parsed = AppDetailsSchema.safeParse(await res.json());
    if (!parsed.success) return { developer: null, publisher: null };
    const appData = parsed.data[String(appid)];
    if (!appData || !appData.success) return { developer: null, publisher: null };
    const developers = appData.data?.developers ?? [];
    const publishers = appData.data?.publishers ?? [];
    return {
      developer: developers[0] ?? null,
      publisher: publishers[0] ?? null,
    };
  } catch {
    return { developer: null, publisher: null };
  }
}

async function fetchSteamGridDbCover(appid: number, apiKey: string): Promise<string | null> {
  try {
    const res = await fetchResilient(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appid}?dimensions=600x900&types=static`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0]?.url as string) ?? null;
  } catch {
    return null;
  }
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<(R | null)[]> {
  const results: (R | null)[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const s of settled) {
      results.push(s.status === "fulfilled" ? s.value : null);
    }
  }
  return results;
}

export async function POST() {
  const apiKey = process.env.STEAM_API_KEY;
  const steamId = process.env.STEAM_USER_ID;
  const sgdbKey = process.env.STEAMGRIDDB_API_KEY;

  if (!apiKey || !steamId) {
    return NextResponse.json(
      { error: "STEAM_API_KEY and STEAM_USER_ID environment variables are required" },
      { status: 500 }
    );
  }

  let ownedGames: SteamGame[];
  try {
    ownedGames = await fetchOwnedGames(apiKey, steamId);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to fetch Steam library: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  // Remove any blocked games already in the DB, then exclude from this sync run.
  const blockedTitles = [...BLOCKED_STEAM_GAME_NAMES];
  await db.game.deleteMany({ where: { title: { in: blockedTitles } } });
  ownedGames = ownedGames.filter(g => !BLOCKED_STEAM_GAME_NAMES.has(g.name));

  if (ownedGames.length === 0) {
    return NextResponse.json({ created: 0, updated: 0, sgdbEnabled: !!sgdbKey });
  }

  // All three data fetches run in parallel batches before the upsert loop.
  // SteamGridDB is pre-fetched here so we don't make serial API calls per-game inside the loop.
  const [achievements, storeDetails, sgdbCovers] = await Promise.all([
    processInBatches(ownedGames, BATCH_SIZE, (g) => fetchAchievements(apiKey, steamId, g.appid)),
    processInBatches(ownedGames, BATCH_SIZE, (g) => fetchStoreDetails(g.appid)),
    sgdbKey
      ? processInBatches(ownedGames, BATCH_SIZE, (g) => fetchSteamGridDbCover(g.appid, sgdbKey))
      : Promise.resolve(ownedGames.map(() => null)),
  ]);

  let created = 0;
  let updated = 0;
  let coversFromSgdb = 0;
  let coversFallback = 0;

  // One lookup for the whole library instead of a findUnique per game. The external HTTP
  // calls above were already batched; this loop was still doing 2N sequential round trips,
  // which on a 500-game library is enough to blow the function timeout on its own.
  const existingGames = await db.game.findMany({
    where: { steamAppId: { in: ownedGames.map((g) => g.appid) } },
  });
  const existingByAppId = new Map(existingGames.map((g) => [g.steamAppId, g]));

  type UpdateOp = { id: string; data: Prisma.GameUpdateInput };
  const updateOps: UpdateOp[] = [];
  const createOps: Prisma.GameCreateManyInput[] = [];

  for (let i = 0; i < ownedGames.length; i++) {
    const game = ownedGames[i];
    const ach = achievements[i];
    const store = storeDetails[i] ?? { developer: null, publisher: null };
    const sgdbUrl = sgdbCovers[i];

    const hoursPlayed = Math.round((game.playtime_forever / 60) * 10) / 10;
    const allAchieved = ach !== null && ach.total > 0 && ach.unlocked === ach.total;

    function pickCover(existing: string | null): string {
      const needsUpgrade = !existing
        || !existing.startsWith("https://")
        || existing.includes("library_600x900");
      if (!needsUpgrade) return existing!;
      if (sgdbUrl) { coversFromSgdb++; return sgdbUrl; }
      coversFallback++;
      return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`;
    }

    const existing = existingByAppId.get(game.appid) ?? null;

    if (existing) {
      const newCover = pickCover(existing.coverImage);
      updateOps.push({
        id: existing.id,
        data: {
          hoursPlayed,
          coverImage: newCover,
          achievementsUnlocked: ach?.unlocked ?? existing.achievementsUnlocked,
          achievementsTotal: ach?.total ?? existing.achievementsTotal,
          ...(allAchieved && existing.status === "PLAYING" ? { status: "PLATINUM" } : {}),
          ...(existing.developer == null && store.developer ? { developer: store.developer } : {}),
          ...(existing.publisher == null && store.publisher ? { publisher: store.publisher } : {}),
        },
      });
      updated++;
    } else {
      const status = allAchieved ? "PLATINUM"
        : game.playtime_forever > 0 ? "PLAYING"
        : "PLAN_TO_PLAY";

      createOps.push({
          title: game.name,
          developer: store.developer ?? undefined,
          publisher: store.publisher ?? undefined,
          platform: "PC",
          emulated: false,
          hoursPlayed,
          achievementsUnlocked: ach?.unlocked ?? 0,
          achievementsTotal: ach?.total ?? undefined,
          coverImage: pickCover(null),
          status,
          steamAppId: game.appid,
      });
      created++;
    }
  }

  // Inserts go in one statement; updates are chunked so a huge library does not build a
  // single oversized transaction.
  if (createOps.length > 0) {
    await db.game.createMany({ data: createOps, skipDuplicates: true });
  }
  const UPDATE_CHUNK = 25;
  for (let i = 0; i < updateOps.length; i += UPDATE_CHUNK) {
    await db.$transaction(
      updateOps.slice(i, i + UPDATE_CHUNK).map((op) =>
        db.game.update({ where: { id: op.id }, data: op.data })
      )
    );
  }

  revalidateTag("library-stats", "max");

  return NextResponse.json({
    created,
    updated,
    sgdbEnabled: !!sgdbKey,
    covers: { sgdb: coversFromSgdb, fallback: coversFallback },
  });
}
