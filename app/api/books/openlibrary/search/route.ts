import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { BookCatalogError } from "@/lib/openlibrary";
import { googleSearchQueryOf } from "@/lib/google-books";
import { searchCatalog } from "@/lib/book-catalog-service";
import { libraryBookPlaces } from "@/lib/openlibrary-import";

export const maxDuration = 60;

/** Search Google Books: `?q=the hobbit` or an ISBN. */
async function GETHandler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const keyed = googleSearchQueryOf(q).kind !== "text";
  if (!keyed && q.length < 2) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
  // A pasted Google Books link can run long; typed words can't.
  if (q.length > (keyed ? 2000 : 200)) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    const { works } = await searchCatalog(q);
    const places = await libraryBookPlaces(works);
    return NextResponse.json({
      works: works.map((w) => ({ ...w, place: places.get(w.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
