import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, tvProgress, WATCH_STATUS } from "@/lib/derive-status";

const createTvShowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  creator: z.string().optional(),
  network: z.string().optional(),
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
  seriesId: z.string().optional().nullable(),
});

async function GETHandler(request: NextRequest) {
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

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createTvShowSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  // A bad series id would otherwise surface as a foreign-key 500.
  if (data.seriesId) {
    const series = await db.tvSeries.findUnique({ where: { id: data.seriesId }, select: { id: true } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const show = await db.tvShow.create({
    data: {
      title: data.title,
      creator: data.creator ?? null,
      network: data.network ?? null,
      // Derived from the counts, never taken from the request.
      status: deriveStatus(tvProgress(data), WATCH_STATUS),
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
      seriesId: data.seriesId || null,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(show, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
