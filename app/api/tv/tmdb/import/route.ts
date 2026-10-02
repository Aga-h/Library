import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { MAX_SHOW_IMPORT, TmdbError } from "@/lib/tmdb-service";
import { importShows } from "@/lib/tmdb-tv-import";

// A full preview is 50 shows, each a call for the show and one per 20 of its seasons.
export const maxDuration = 60;

const schema = z.object({
  universeId: z.string().min(1).nullable(),
  tmdbIds: z.array(z.number().int().positive()).min(1).max(MAX_SHOW_IMPORT),
  /** Mark every aired episode of the new seasons as watched. */
  watched: z.boolean().default(false),
});

/**
 * Import shows from TMDB — or import one again ("Check for new seasons") to add new seasons and
 * episodes. Only ever adds.
 */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { universeId, tmdbIds, watched } = result.data;
  try {
    const imported = await importShows(universeId, tmdbIds, watched);
    revalidateTag("library-stats", "max");
    const added = imported.report.some((line) => line.outcome === "added" || line.seasonsAdded.length > 0);
    return NextResponse.json(imported, { status: added ? 201 : 200 });
  } catch (e) {
    if (e instanceof TmdbError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
