import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPABASE_COVER_MARKER, mirrorCover } from "@/lib/covers";
import { withErrors } from "@/lib/api-errors";

const MIRROR_BATCH = 10;

// Only issues carry artwork now — publishers, universes and comic titles lost their
// covers, so there is nothing to mirror at those levels.
async function POSTHandler() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" },
      { status: 500 }
    );
  }

  // Filter in SQL — reading the whole table to keep 10 rows sent the entire library
  // across the wire on every click.
  const pendingWhere = {
    coverImage: { not: null },
    NOT: { coverImage: { contains: SUPABASE_COVER_MARKER } },
  };

  const [batch, pendingCount] = await Promise.all([
    db.comicIssue.findMany({
      where: pendingWhere,
      select: { id: true, coverImage: true },
      take: MIRROR_BATCH,
    }),
    db.comicIssue.count({ where: pendingWhere }),
  ]);

  let mirrored = 0;
  let lastError: string | null = null;
  await Promise.allSettled(
    batch.map(async (item) => {
      if (!item.coverImage) return;
      try {
        const url = await mirrorCover(item.coverImage, `comic-issues/${item.id}.jpg`);
        await db.comicIssue.update({ where: { id: item.id }, data: { coverImage: url } });
        mirrored++;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    })
  );

  if (mirrored === 0 && batch.length > 0 && lastError) {
    return NextResponse.json({ error: lastError }, { status: 502 });
  }

  return NextResponse.json({ mirrored, remaining: pendingCount - mirrored });
}

export const POST = withErrors(POSTHandler);
