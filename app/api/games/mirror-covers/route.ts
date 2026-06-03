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
  await Promise.allSettled(
    batch.map(async (game) => {
      try {
        const path = `games/${game.steamAppId ?? game.id}.jpg`;
        const newUrl = await mirrorCover(game.coverImage!, path);
        await db.game.update({ where: { id: game.id }, data: { coverImage: newUrl } });
        mirrored++;
      } catch {
        // leave original URL in place
      }
    })
  );

  return NextResponse.json({ mirrored, remaining: pending.length - mirrored });
}
