import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { BookCatalogError } from "@/lib/openlibrary";
import { searchEditions } from "@/lib/book-catalog-service";

export const maxDuration = 60;

/** Every Google Books edition of one novel: `?title=Piranesi&author=Susanna Clarke`. */
async function GETHandler(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  const author = request.nextUrl.searchParams.get("author")?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Which book?" }, { status: 400 });
  if (title.length > 300 || author.length > 200) {
    return NextResponse.json({ error: "That title is too long." }, { status: 400 });
  }

  try {
    return NextResponse.json({ editions: await searchEditions({ title, author: author || "Unknown" }) });
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
