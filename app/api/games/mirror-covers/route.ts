import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSupabaseCover, mirrorCover } from "@/lib/covers";

const MIRROR_BATCH = 10;

export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" },
      { status: 500 }
    );
  }

  const allGames = await db.game.findMany({
    select: { id: true, coverImage: true, steamAppId: true },
  });
  const pending = allGames.filter(g => !!g.coverImage && !isSupabaseCover(g.coverImage));
  const batch = pending.slice(0, MIRROR_BATCH);

  let mirrored = 0;
  let lastError: string | null = null;
  await Promise.allSettled(
    batch.map(async (game) => {
      try {
        const path = `games/${game.steamAppId ?? game.id}.jpg`;
        const newUrl = await mirrorCover(game.coverImage!, path);
        await db.game.update({ where: { id: game.id }, data: { coverImage: newUrl } });
        mirrored++;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    })
  );

  if (mirrored === 0 && batch.length > 0 && lastError) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ mirrored, remaining: pending.length - mirrored });
}
