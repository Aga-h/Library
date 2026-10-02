import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { TmdbError, keywordShows } from "@/lib/tmdb-service";
import { libraryShowPlaces } from "@/lib/tmdb-tv-import";

/** The shows under a TMDB keyword tag (`?keyword=180547`), each marked with where it already is. */
async function GETHandler(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("keyword");
  const keyword = raw !== null && /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  if (keyword <= 0) return NextResponse.json({ error: "Give a keyword id." }, { status: 400 });

  try {
    const list = await keywordShows(keyword);
    const places = await libraryShowPlaces(list.shows.map((s) => s.id));
    return NextResponse.json({
      ...list,
      shows: list.shows.map((s) => ({ ...s, place: places.get(s.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
