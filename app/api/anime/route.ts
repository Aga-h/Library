import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, animeProgress, WATCH_STATUS } from "@/lib/derive-status";

const createAnimeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  studio: z.string().optional(),
  episodes: z.number().int().optional(),
  episodesWatched: z.number().int().default(0),
  episodeDuration: z.number().int().default(24),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional(),
  year: z.number().int().optional(),
  language: z.enum(LANGUAGE_VALUES)
    .default("JAPANESE"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesRewatched: z.number().int().min(0).default(0),
  seriesName: z.string().optional(),
});

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const anime = await db.anime.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(anime);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createAnimeSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const anime = await db.anime.create({
    data: {
      title: data.title,
      studio: data.studio ?? null,
      // Derived from the counts, never taken from the request.
      status: deriveStatus(animeProgress(data), WATCH_STATUS),
      episodes: data.episodes ?? null,
      episodesWatched: data.episodesWatched,
      episodeDuration: data.episodeDuration,
      season: data.season ?? null,
      year: data.year ?? null,
      language: data.language,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesRewatched: data.timesRewatched,
      seriesName: data.seriesName || null,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(anime, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
