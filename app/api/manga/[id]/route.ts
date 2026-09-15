import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, mangaProgress, READ_STATUS } from "@/lib/derive-status";

const updateMangaSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  artist: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  totalVolumes: z.number().int().optional().nullable(),
  volumesRead: z.number().int().optional(),
  totalChapters: z.number().int().optional().nullable(),
  chaptersRead: z.number().int().optional(),
  ongoing: z.boolean().optional(),
  language: z.enum(LANGUAGE_VALUES)
    .optional(),
  format: z.enum(["MANGA", "MANHWA", "MANHUA"]).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  timesReread: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }
  return NextResponse.json(manga);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateMangaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.manga.update({
    where: { id },
    // "" is normalised to null: POST guarded this but PATCH spread the parsed body straight
    // through, so a cleared cover was stored as an empty string rather than NULL.
    // Merge over the stored row before deriving: a PATCH that only changes the rating
    // must still land on the right status, and one that only changes the progress needs
    // the stored total to compare against.
    data: {
      ...result.data,
      ...(result.data.coverImage === "" ? { coverImage: null } : {}),
      status: deriveStatus(mangaProgress({ ...manga, ...result.data }), READ_STATUS),
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  await db.manga.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
