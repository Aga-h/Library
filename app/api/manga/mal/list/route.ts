import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { MalError, userMangaList } from "@/lib/mal-service";
import { rowsFromApiManga } from "@/lib/mal-manga-list";

export const maxDuration = 60;

/** A MyAnimeList user's manga list — `?user=name` — as list rows, with status and progress. */
async function GETHandler(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(user)) {
    return NextResponse.json({ error: "That isn't a MyAnimeList username." }, { status: 400 });
  }
  try {
    return NextResponse.json({ rows: rowsFromApiManga(await userMangaList(user)) });
  } catch (e) {
    if (e instanceof MalError) {
      const message = e.status === 404 ? "No MyAnimeList user by that name." : e.message;
      return NextResponse.json({ error: message }, { status: e.status });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
