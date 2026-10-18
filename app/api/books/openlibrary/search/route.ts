import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { isbnOf, workIdOf } from "@/lib/openlibrary";
import { OpenLibraryError, searchWorks } from "@/lib/openlibrary-service";
import { libraryBookPlaces } from "@/lib/openlibrary-import";

/** Search Open Library: `?q=the hobbit` or an ISBN. */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const keyed = isbnOf(q) !== null || workIdOf(q) !== null;
  if (!keyed && q.length < 2) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    const works = await searchWorks(q);
    const places = await libraryBookPlaces(works);
    return NextResponse.json({ works: works.map((w) => ({ ...w, place: places.get(w.id) ?? null })) });
  } catch (e) {
    if (e instanceof OpenLibraryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
