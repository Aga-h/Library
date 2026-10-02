import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { MalError, walkRun } from "@/lib/mal-service";
import { libraryAnimePlaces } from "@/lib/mal-import";

// A long run is ~20 entries, fetched three at a time.
export const maxDuration = 60;

/** A whole run — `?id=16498` and every sequel and prequel — each marked with where it already is. */
async function GETHandler(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("id");
  const id = raw !== null && /^\d{1,10}$/.test(raw) ? Number(raw) : 0;
  if (id <= 0) return NextResponse.json({ error: "Give a MyAnimeList id." }, { status: 400 });

  try {
    const run = await walkRun(id);
    const places = await libraryAnimePlaces(run.entries.map((e) => e.id));
    return NextResponse.json({ ...run, entries: run.entries.map((e) => ({ ...e, place: places.get(e.id) ?? null })) });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
