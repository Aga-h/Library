import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const updateMangaSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  artist: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  status: z
    .enum(["READING", "COMPLETED", "PLAN_TO_READ", "DROPPED", "ON_HOLD"])
    .optional(),
  totalVolumes: z.number().int().optional().nullable(),
  volumesRead: z.number().int().optional(),
  totalChapters: z.number().int().optional().nullable(),
  chaptersRead: z.number().int().optional(),
  language: z
    .enum([
      "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
      "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
      "JAPANESE", "CHINESE", "KOREAN",
    ])
    .optional(),
  format: z.enum(["MANGA", "MANHWA", "MANHUA"]).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  rating: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  timesReread: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }
  return NextResponse.json(manga);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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
    data: result.data,
  });

  revalidateTag("library-stats");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  await db.manga.delete({ where: { id } });
  revalidateTag("library-stats");
  return new NextResponse(null, { status: 204 });
}
