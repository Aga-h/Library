import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const BATCH_SIZE = 5;
const COVER_BATCH_SIZE = 100;

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

async function fetchCoverUrls(appids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (let i = 0; i < appids.length; i += COVER_BATCH_SIZE) {
    const batch = appids.slice(i, i + COVER_BATCH_SIZE);
    try {
      const input = JSON.stringify({
        ids: batch.map(appid => ({ appid })),
        context: { country_code: "US", language: "english" },
        data_request: { include_assets: true },
      });
      const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(input)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const items: { id?: number; appid?: number; assets?: { asset_url_format?: string; library_capsule_2x?: string; library_capsule?: string } }[] =
        data.response?.store_items ?? [];
      for (const item of items) {
        const id = item.appid ?? item.id;
        if (!id) continue;
        const fmt: string = item.assets?.asset_url_format ?? "";
        const filename: string | null =
          item.assets?.library_capsule_2x ?? item.assets?.library_capsule ?? null;
        if (fmt && filename) {
          map.set(id, fmt.replace("${FILENAME}", filename));
        }
      }
    } catch {
      // continue with next batch
    }
  }
  return map;
}

async function fetchSteamGridDbCover(appid: number, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${appid}?dimensions=600x900`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.[0]?.url as string) ?? null;
  } catch {
    return null;
  }
}

async function resolveCover(appid: number, coverMap: Map<number, string>, sgdbKey?: string): Promise<string> {
  const fromGetItems = coverMap.get(appid);
  if (fromGetItems) return fromGetItems;

  if (sgdbKey) {
    const fromSgdb = await fetchSteamGridDbCover(appid, sgdbKey);
    if (fromSgdb) return fromSgdb;
  }

  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
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
    return NextResponse.json({ created: 0, updated: 0 });
  }

  const appids = ownedGames.map(g => g.appid);

  // Fetch cover URLs in large batches (100 per call) — runs before the upsert loop
  const coverMap = await fetchCoverUrls(appids);

  // Fetch achievements and store details in parallel batches
  const achievements = await processInBatches(
    ownedGames,
    BATCH_SIZE,
    (g) => fetchAchievements(apiKey, steamId, g.appid)
  );

  const storeDetails = await processInBatches(
    ownedGames,
    BATCH_SIZE,
    (g) => fetchStoreDetails(g.appid)
  );

  let created = 0;
  let updated = 0;

  for (let i = 0; i < ownedGames.length; i++) {
    const game = ownedGames[i];
    const ach = achievements[i];
    const store = storeDetails[i] ?? { developer: null, publisher: null };

    const hoursPlayed = Math.round((game.playtime_forever / 60) * 10) / 10;
    const allAchieved = ach !== null && ach.total > 0 && ach.unlocked === ach.total;
    const newCoverUrl = coverMap.get(game.appid);

    const existing = await db.game.findUnique({ where: { steamAppId: game.appid } });

    if (existing) {
      await db.game.update({
        where: { id: existing.id },
        data: {
          hoursPlayed,
          ...(newCoverUrl ? { coverImage: newCoverUrl } : {}),
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

      const coverImage = await resolveCover(game.appid, coverMap, sgdbKey);
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
          coverImage,
          status,
          steamAppId: game.appid,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated });
}
