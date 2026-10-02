import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { MAX_RUN, MalError } from "@/lib/mal-service";
import { importRun } from "@/lib/mal-import";

export const maxDuration = 60;

const schema = z.object({
  universeId: z.string().min(1).nullable(),
  malIds: z.array(z.number().int().positive()).min(1).max(MAX_RUN),
  /** Mark finished entries fully watched. */
  watched: z.boolean().default(false),
  /** Store English titles where MyAnimeList has one. */
  english: z.boolean().default(true),
});

/** Import MyAnimeList entries — a run as a series, or one entry on its own. Only ever adds. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { universeId, malIds, watched, english } = result.data;
  try {
    const imported = await importRun(universeId, malIds, { watched, english });
    revalidateTag("library-stats", "max");
    const added = imported.entries.some((line) => line.outcome === "added");
    return NextResponse.json(imported, { status: added ? 201 : 200 });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
