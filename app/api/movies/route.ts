import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";

const createMovieSchema = z.object({
  title: z.string().min(1, "Title is required"),
  director: z.string().optional(),
  studio: z.string().optional(),
  status: z
    .enum(["WATCHED", "WANT_TO_WATCH", "DROPPED"])
    .default("WANT_TO_WATCH"),
  runtime: z.number().int().positive("Runtime is required"),
  year: z.number().int().optional(),
  language: z.enum(LANGUAGE_VALUES)
    .default("ENGLISH"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesRewatched: z.number().int().min(0).default(0),
  universeId: z.string().optional().nullable(),
});

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const movies = await db.movie.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(movies);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createMovieSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  // A bad universe id would otherwise surface as a foreign-key 500.
  if (data.universeId) {
    const universe = await db.movieUniverse.findUnique({ where: { id: data.universeId }, select: { id: true } });
    if (!universe) return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  const movie = await db.movie.create({
    data: {
      title: data.title,
      director: data.director ?? null,
      studio: data.studio ?? null,
      status: data.status,
      runtime: data.runtime,
      year: data.year ?? null,
      language: data.language,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesRewatched: data.timesRewatched,
      universeId: data.universeId || null,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(movie, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
