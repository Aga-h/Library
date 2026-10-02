import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withErrors } from "@/lib/api-errors";
import { MalError } from "@/lib/mal-service";
import { refreshSeries } from "@/lib/mal-import";

export const maxDuration = 60;

const schema = z.object({ seriesId: z.string().min(1) });

/** "Check for new seasons": bring a series up to date with MyAnimeList. Only ever adds. */
async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  try {
    const refreshed = await refreshSeries(result.data.seriesId);
    revalidateTag("library-stats", "max");
    return NextResponse.json(refreshed);
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
