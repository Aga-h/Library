import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, animeProgress, WATCH_STATUS } from "@/lib/derive-status";

const updateAnimeSchema = z.object({
  title: z.string().min(1).optional(),
  studio: z.string().optional().nullable(),
  episodes: z.number().int().optional().nullable(),
  episodesWatched: z.number().int().optional(),
  episodeDuration: z.number().int().optional(),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional().nullable(),
  year: z.number().int().optional().nullable(),
  language: z.enum(LANGUAGE_VALUES)
    .optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  timesRewatched: z.number().int().min(0).optional(),
  seriesId: z.string().optional().nullable(),
  seasonNumber: z.number().int().min(1).optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const anime = await db.anime.findUnique({ where: { id } });
  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }
  return NextResponse.json(anime);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const anime = await db.anime.findUnique({ where: { id } });
  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateAnimeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  // A bad series id would otherwise surface as a foreign-key 500.
  if (result.data.seriesId) {
    const series = await db.animeSeries.findUnique({ where: { id: result.data.seriesId }, select: { id: true } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const updated = await db.anime.update({
    where: { id },
    // "" is normalised to null: POST guarded this but PATCH spread the parsed body straight
    // through, so a cleared cover was stored as an empty string rather than NULL.
    // Merge over the stored row before deriving: a PATCH that only changes the rating
    // must still land on the right status, and one that only changes the progress needs
    // the stored total to compare against.
    data: {
      ...result.data,
      ...(result.data.coverImage === "" ? { coverImage: null } : {}),
      status: deriveStatus(animeProgress({ ...anime, ...result.data }), WATCH_STATUS),
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const anime = await db.anime.findUnique({ where: { id } });
  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  await db.anime.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
