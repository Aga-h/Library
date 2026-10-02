import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { TmdbError, search } from "@/lib/tmdb-service";
import { libraryPlaces } from "@/lib/tmdb-import";

/** Search TMDB: `?q=harry potter` → films, collections and keyword tags. */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    const results = await search(q);
    const places = await libraryPlaces(results.films.map((f) => f.id));
    return NextResponse.json({
      ...results,
      films: results.films.map((f) => ({ ...f, place: places.get(f.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
