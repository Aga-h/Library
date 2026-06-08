import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const updateTvShowSchema = z.object({
  title: z.string().min(1).optional(),
  creator: z.string().optional().nullable(),
  network: z.string().optional().nullable(),
  status: z
    .enum(["WATCHING", "COMPLETED", "PLAN_TO_WATCH", "DROPPED", "ON_HOLD"])
    .optional(),
  totalEpisodes: z.number().int().optional().nullable(),
  episodesWatched: z.number().int().optional(),
  episodeRuntime: z.number().int().optional(),
  year: z.number().int().optional().nullable(),
  language: z
    .enum([
      "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
      "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
      "JAPANESE", "CHINESE", "KOREAN",
    ])
    .optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  timesRewatched: z.number().int().min(0).optional(),
  seriesName: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const show = await db.tvShow.findUnique({ where: { id } });
  if (!show) {
    return NextResponse.json({ error: "TV show not found" }, { status: 404 });
  }
  return NextResponse.json(show);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const show = await db.tvShow.findUnique({ where: { id } });
  if (!show) {
    return NextResponse.json({ error: "TV show not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateTvShowSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.tvShow.update({
    where: { id },
    data: result.data,
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const show = await db.tvShow.findUnique({ where: { id } });
  if (!show) {
    return NextResponse.json({ error: "TV show not found" }, { status: 404 });
  }

  await db.tvShow.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
