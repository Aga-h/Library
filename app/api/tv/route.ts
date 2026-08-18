import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";

const createTvShowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  creator: z.string().optional(),
  network: z.string().optional(),
  status: z
    .enum(["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "DROPPED", "ON_HOLD"])
    .default("PLAN_TO_WATCH"),
  totalEpisodes: z.number().int().optional(),
  episodesWatched: z.number().int().default(0),
  episodeRuntime: z.number().int().default(45),
  year: z.number().int().optional(),
  language: z.enum(LANGUAGE_VALUES)
    .default("ENGLISH"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesRewatched: z.number().int().min(0).default(0),
  seriesName: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const shows = await db.tvShow.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createTvShowSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const show = await db.tvShow.create({
    data: {
      title: data.title,
      creator: data.creator ?? null,
      network: data.network ?? null,
      status: data.status,
      totalEpisodes: data.totalEpisodes ?? null,
      episodesWatched: data.episodesWatched,
      episodeRuntime: data.episodeRuntime,
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
  return NextResponse.json(show, { status: 201 });
}
