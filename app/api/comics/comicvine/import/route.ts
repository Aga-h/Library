import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { ComicVineError } from "@/lib/comicvine-service";
import { importRun } from "@/lib/comicvine-import";

// A long run is ten or more pages of 100 issues, fetched one after another with a pause between.
export const maxDuration = 60;

const schema = z.object({
  universeId: z.string().min(1),
  volumeId: z.number().int().positive(),
});

/** Import a Comic Vine run — or import it again, to pick up new issues. Only ever adds. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  try {
    const imported = await importRun(result.data.universeId, result.data.volumeId);
    revalidateTag("library-stats", "max");
    return NextResponse.json(imported, { status: imported.createdTitle ? 201 : 200 });
  } catch (e) {
    if (e instanceof ComicVineError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
