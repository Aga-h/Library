import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const updateMovieSchema = z.object({
  title: z.string().min(1).optional(),
  director: z.string().optional().nullable(),
  studio: z.string().optional().nullable(),
  status: z.enum(["WATCHED", "WANT_TO_WATCH", "DROPPED"]).optional(),
  runtime: z.number().int().positive().optional(),
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
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }
  return NextResponse.json(movie);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateMovieSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.movie.update({
    where: { id },
    data: result.data,
  });

  revalidateTag("library-stats");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  await db.movie.delete({ where: { id } });
  revalidateTag("library-stats");
  return new NextResponse(null, { status: 204 });
}
