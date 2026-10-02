import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { TmdbError, searchTv } from "@/lib/tmdb-service";
import { libraryShowPlaces } from "@/lib/tmdb-tv-import";

/** Search TMDB for TV: `?q=star trek` → shows and keyword tags. */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    const results = await searchTv(q);
    const places = await libraryShowPlaces(results.shows.map((s) => s.id));
    return NextResponse.json({
      ...results,
      shows: results.shows.map((s) => ({ ...s, place: places.get(s.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
