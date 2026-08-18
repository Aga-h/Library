import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPABASE_COVER_MARKER, mirrorCover } from "@/lib/covers";
import { withErrors } from "@/lib/api-errors";

const MIRROR_BATCH = 10;

async function POSTHandler() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" },
      { status: 500 }
    );
  }

  // Filter in SQL rather than reading the whole table and discarding all but 10 rows.
  const pendingWhere = {
    coverImage: { not: null },
    NOT: { coverImage: { contains: SUPABASE_COVER_MARKER } },
  } as const;

  const [batch, pendingCount] = await Promise.all([
    db.book.findMany({ where: pendingWhere, select: { id: true, coverImage: true }, take: MIRROR_BATCH }),
    db.book.count({ where: pendingWhere }),
  ]);

  let mirrored = 0;
  let lastError: string | null = null;
  await Promise.allSettled(
    batch.map(async (item) => {
      try {
        const path = `books/${item.id}.jpg`;
        const newUrl = await mirrorCover(item.coverImage!, path);
        await db.book.update({ where: { id: item.id }, data: { coverImage: newUrl } });
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
