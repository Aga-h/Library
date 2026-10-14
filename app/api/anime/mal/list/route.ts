import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { MalError, completedList } from "@/lib/mal-service";

export const maxDuration = 60;

/** A MyAnimeList user's Completed list: `?user=name`. Only public lists can be read. */
async function GETHandler(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user")?.trim() ?? "";
  // MyAnimeList usernames: 2–16 letters, digits, - and _.
  if (!/^[\w-]{2,20}$/.test(user)) return NextResponse.json({ error: "That isn't a MyAnimeList username." }, { status: 400 });

  try {
    return NextResponse.json({ rows: await completedList(user) });
  } catch (e) {
    if (e instanceof MalError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
