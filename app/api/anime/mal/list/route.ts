import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { MalError, userCompleted } from "@/lib/mal-service";
import { libraryAnimePlaces } from "@/lib/mal-import";

export const maxDuration = 60;

/** A MyAnimeList user's completed anime — `?user=name` — each marked with where it already is. */
async function GETHandler(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(user)) {
    return NextResponse.json({ error: "That isn't a MyAnimeList username." }, { status: 400 });
  }
  try {
    const listed = await userCompleted(user);
    const places = await libraryAnimePlaces(listed.map((l) => l.entry.id));
    return NextResponse.json({
      entries: listed.map((l) => ({ ...l.entry, score: l.score, place: places.get(l.entry.id) ?? null })),
    });
  } catch (e) {
    if (e instanceof MalError) {
      const message = e.status === 404 ? "No MyAnimeList user by that name." : e.message;
      return NextResponse.json({ error: message }, { status: e.status });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
