import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { MalError, searchManga } from "@/lib/mal-service";
import { libraryMangaPlaces } from "@/lib/mal-manga-import";

/** Search MyAnimeList's manga: `?q=berserk`. MyAnimeList wants at least three letters. */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ error: "Type at least three letters to search." }, { status: 400 });
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    const entries = await searchManga(q);
    const places = await libraryMangaPlaces(entries);
    return NextResponse.json({ entries: entries.map((m) => ({ ...m, place: places.get(m.id) ?? null })) });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
