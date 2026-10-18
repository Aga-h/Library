import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { BookCatalogError } from "@/lib/openlibrary";
import { refreshBook } from "@/lib/openlibrary-import";

const schema = z.object({ bookId: z.string().min(1) });

/** "Check catalogues": a cover, author or publisher it was missing. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  try {
    const refreshed = await refreshBook(result.data.bookId);
    if (refreshed.changed.length > 0) revalidateTag("library-stats", "max");
    return NextResponse.json(refreshed);
  } catch (e) {
    if (e instanceof BookCatalogError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
