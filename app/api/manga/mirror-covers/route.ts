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

  const all = await db.manga.findMany({ select: { id: true, coverImage: true } });
  const pending = all.filter(m => !!m.coverImage && !isSupabaseCover(m.coverImage));
  const batch = pending.slice(0, MIRROR_BATCH);

  let mirrored = 0;
  let lastError: string | null = null;
  await Promise.allSettled(
    batch.map(async (item) => {
      try {
        const path = `manga/${item.id}.jpg`;
        const newUrl = await mirrorCover(item.coverImage!, path);
        await db.manga.update({ where: { id: item.id }, data: { coverImage: newUrl } });
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
