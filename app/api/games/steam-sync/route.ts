import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const BATCH_SIZE = 5;

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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
  const data = await res.json();
  return (data.response?.games ?? []) as SteamGame[];
}

async function fetchAchievements(apiKey: string, steamId: string, appid: number): Promise<AchievementResult | null> {
  try {
    const url =
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
      `?key=${apiKey}&steamid=${steamId}&appid=${appid}&format=json`;
    const res = await fetch(url, { cache: "no-store" });
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { developer: null, publisher: null };
    const data = await res.json();
    const appData = data[String(appid)];
    if (!appData?.success) return { developer: null, publisher: null };
    const developers: string[] = appData.data?.developers ?? [];
    const publishers: string[] = appData.data?.publishers ?? [];
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
    const res = await fetch(
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

  for (let i = 0; i < ownedGames.length; i++) {
    const game = ownedGames[i];
    const ach = achievements[i];
    const store = storeDetails[i] ?? { developer: null, publisher: null };
    const sgdbUrl = sgdbCovers[i];

    const hoursPlayed = Math.round((game.playtime_forever / 60) * 10) / 10;
    const allAchieved = ach !== null && ach.total > 0 && ach.unlocked === ach.total;

    function pickCover(existing: string | null): string {
      // Always try to upgrade null, header.jpg, or bare library_600x900 fallbacks
      const needsUpgrade = !existing
        || existing.endsWith("header.jpg")
        || existing.includes("library_600x900.jpg");
      if (!needsUpgrade) return existing!;
      if (sgdbUrl) { coversFromSgdb++; return sgdbUrl; }
      coversFallback++;
      return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`;
    }

    const existing = await db.game.findUnique({ where: { steamAppId: game.appid } });

    if (existing) {
      const newCover = pickCover(existing.coverImage);
      await db.game.update({
        where: { id: existing.id },
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

      await db.game.create({
        data: {
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
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    created,
    updated,
    sgdbEnabled: !!sgdbKey,
    covers: { sgdb: coversFromSgdb, fallback: coversFallback },
  });
}
