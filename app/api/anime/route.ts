import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createAnimeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  studio: z.string().optional(),
  status: z
    .enum(["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "DROPPED", "ON_HOLD"])
    .default("PLAN_TO_WATCH"),
  episodes: z.number().int().optional(),
  episodesWatched: z.number().int().default(0),
  episodeDuration: z.number().int().default(24),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional(),
  year: z.number().int().optional(),
  language: z
    .enum([
      "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
      "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
      "JAPANESE", "CHINESE", "KOREAN",
    ])
    .default("JAPANESE"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesRewatched: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
      status: data.status,
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
    },
  });

  return NextResponse.json(anime, { status: 201 });
}
