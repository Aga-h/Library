import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";

const updateMovieSchema = z.object({
  title: z.string().min(1).optional(),
  director: z.string().optional().nullable(),
  studio: z.string().optional().nullable(),
  status: z.enum(["WATCHED", "WANT_TO_WATCH", "DROPPED"]).optional(),
  runtime: z.number().int().positive().optional(),
  year: z.number().int().optional().nullable(),
  language: z.enum(LANGUAGE_VALUES)
    .optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  timesRewatched: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }
  return NextResponse.json(movie);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
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
    // "" is normalised to null: POST guarded this but PATCH spread the parsed body straight
    // through, so a cleared cover was stored as an empty string rather than NULL.
    data: { ...result.data, ...(result.data.coverImage === "" ? { coverImage: null } : {}) },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  await db.movie.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
