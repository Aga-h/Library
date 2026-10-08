import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { MalError } from "@/lib/mal-service";
import { refreshManga } from "@/lib/mal-manga-import";

const schema = z.object({ mangaId: z.string().min(1) });

/** "Check MyAnimeList": final counts once a series ends, and anything it was missing. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  try {
    const refreshed = await refreshManga(result.data.mangaId);
    if (refreshed.changed.length > 0) revalidateTag("library-stats", "max");
    return NextResponse.json(refreshed);
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
