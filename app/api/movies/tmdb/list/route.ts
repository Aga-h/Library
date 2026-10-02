import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { TmdbError, collectionFilms, keywordFilms } from "@/lib/tmdb-service";
import { libraryPlaces } from "@/lib/tmdb-import";

function positiveId(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/**
 * The films in a TMDB collection (`?collection=1241`) or under a keyword tag (`?keyword=180547`),
 * each marked with where it already is in the library — what the import preview lists.
 */
async function GETHandler(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const collection = positiveId(params.get("collection"));
  const keyword = positiveId(params.get("keyword"));
  if ((collection === null) === (keyword === null)) {
    return NextResponse.json({ error: "Give exactly one of collection or keyword." }, { status: 400 });
  }

  try {
    const list = collection !== null ? await collectionFilms(collection) : await keywordFilms(keyword!);
    const places = await libraryPlaces(list.films.map((f) => f.id));
    return NextResponse.json({
      ...list,
      films: list.films.map((f) => ({ ...f, place: places.get(f.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
