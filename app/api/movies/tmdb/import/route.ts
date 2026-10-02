import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { MAX_IMPORT, TmdbError } from "@/lib/tmdb-service";
import { importFilms } from "@/lib/tmdb-import";

// A full preview is 100 detail requests, six at a time.
export const maxDuration = 60;

const schema = z.object({
  universeId: z.string().min(1).nullable(),
  tmdbIds: z.array(z.number().int().positive()).min(1).max(MAX_IMPORT),
  status: z.enum(["WANT_TO_WATCH", "WATCHED"]).default("WANT_TO_WATCH"),
});

/** Import films from TMDB — or import them again, to fill in what was missing. Only ever adds. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { universeId, tmdbIds, status } = result.data;
  try {
    const imported = await importFilms(universeId, tmdbIds, status);
    revalidateTag("library-stats", "max");
    const added = imported.report.some((line) => line.outcome === "added");
    return NextResponse.json(imported, { status: added ? 201 : 200 });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
