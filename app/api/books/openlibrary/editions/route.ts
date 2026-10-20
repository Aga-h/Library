import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { BookCatalogError } from "@/lib/openlibrary";
import { googleVolumeIdOf } from "@/lib/google-books";
import { searchEditions } from "@/lib/book-catalog-service";

export const maxDuration = 60;

/** Every Google Books edition of one book: `?id=<one of its volumes>&title=Piranesi&author=Susanna Clarke`. */
async function GETHandler(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = googleVolumeIdOf(params.get("id"));
  const title = params.get("title")?.trim() ?? "";
  const author = params.get("author")?.trim() ?? "";
  if (!id || !title) return NextResponse.json({ error: "Which book?" }, { status: 400 });
  if (title.length > 300 || author.length > 200) {
    return NextResponse.json({ error: "That title is too long." }, { status: 400 });
  }

  try {
    return NextResponse.json(await searchEditions({ title, author: author || "Unknown" }, id));
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
