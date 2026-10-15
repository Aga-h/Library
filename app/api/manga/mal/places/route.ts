import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { db } from "@/lib/db";

const schema = z.object({ malIds: z.array(z.number().int().positive()).max(5000) });

/**
 * Which of these MyAnimeList manga are in the library already — so a list import starts with them
 * unticked. Only the database is asked, never MyAnimeList.
 */
async function POSTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  const rows = await db.manga.findMany({
    where: { malId: { in: parsed.data.malIds } },
    select: { malId: true, id: true },
  });
  return NextResponse.json({ have: rows.map((r) => ({ malId: r.malId!, mangaId: r.id })) });
}

export const POST = withErrors(POSTHandler);
