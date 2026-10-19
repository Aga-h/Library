import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { BookCatalogError } from "@/lib/openlibrary";
import { googleVolumeIdOf } from "@/lib/google-books";
import { catalogEdition } from "@/lib/book-catalog-service";

/** One Google Books edition, `?id=<volume id>`: the page count a search left out, for the picker. */
async function GETHandler(request: NextRequest) {
  const id = googleVolumeIdOf(request.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Which edition?" }, { status: 400 });
  try {
    return NextResponse.json({ edition: await catalogEdition(id) });
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
