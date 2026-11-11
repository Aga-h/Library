import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { SHARE_KINDS, type ShareKind } from "@/lib/media-share";
import { ShareError, searchKind } from "@/lib/media-share-service";

export const maxDuration = 60;

/** Search a kind's catalogue to pick something to send: `?kind=anime&q=frieren`. */
async function GETHandler(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  if (!(SHARE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Pick movie, tv, anime, manga or book." }, { status: 400 });
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  // MyAnimeList wants three letters; the others take two.
  const least = kind === "anime" || kind === "manga" ? 3 : 2;
  if (q.length < least) {
    return NextResponse.json({ error: `Type at least ${least === 3 ? "three" : "two"} letters to search.` }, { status: 400 });
  }
  if (q.length > 100) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  try {
    return NextResponse.json({ results: await searchKind(kind as ShareKind, q) });
  } catch (e) {
    if (e instanceof ShareError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const GET = withErrors(GETHandler);
