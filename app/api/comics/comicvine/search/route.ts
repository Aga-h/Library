import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { rankVolumes } from "@/lib/comicvine";
import { ComicVineError, searchVolumes } from "@/lib/comicvine-service";

/**
 * Search Comic Vine for runs. `?q=amazing spider-man&publisherId=…` — the publisher is only used to
 * put its own runs first, never to hide others.
 */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  const publisherId = request.nextUrl.searchParams.get("publisherId");
  const publisher = publisherId
    ? await db.comicPublisher.findUnique({ where: { id: publisherId }, select: { name: true } })
    : null;

  try {
    const volumes = await searchVolumes(q);
    return NextResponse.json({ results: rankVolumes(volumes, publisher?.name ?? null) });
  } catch (e) {
    if (e instanceof ComicVineError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
