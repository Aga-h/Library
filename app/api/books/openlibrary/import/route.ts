import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { MAX_IMPORT } from "@/lib/openlibrary";
import { OpenLibraryError } from "@/lib/openlibrary-service";
import { importWorks } from "@/lib/openlibrary-import";

export const maxDuration = 60;

const schema = z.object({
  workIds: z.array(z.string().regex(/^OL\d+W$/i)).min(1).max(MAX_IMPORT),
  read: z.boolean().default(false),
  language: z.enum(LANGUAGE_VALUES).default("ENGLISH"),
  seriesId: z.string().min(1).nullable().default(null),
  /** Link this book, already in the library, to the work instead. */
  bookId: z.string().min(1).optional(),
});

/** Import works from Open Library — or import them again, to fill in what was missing. Only ever adds. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { workIds, ...options } = result.data;
  try {
    const imported = await importWorks(workIds.map((id) => id.toUpperCase()), options);
    revalidateTag("library-stats", "max");
    const added = imported.report.some((line) => line.outcome === "added");
    return NextResponse.json(imported, { status: added ? 201 : 200 });
  } catch (e) {
    if (e instanceof OpenLibraryError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
