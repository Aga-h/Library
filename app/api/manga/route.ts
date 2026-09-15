import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, mangaProgress, READ_STATUS } from "@/lib/derive-status";

const createMangaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  artist: z.string().optional(),
  publisher: z.string().optional(),
  totalVolumes: z.number().int().optional(),
  volumesRead: z.number().int().default(0),
  totalChapters: z.number().int().optional(),
  chaptersRead: z.number().int().default(0),
  ongoing: z.boolean().default(false),
  language: z.enum(LANGUAGE_VALUES)
    .default("JAPANESE"),
  format: z.enum(["MANGA", "MANHWA", "MANHUA"]).default("MANGA"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesReread: z.number().int().min(0).default(0),
});

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const manga = await db.manga.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(manga);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createMangaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const manga = await db.manga.create({
    data: {
      title: data.title,
      author: data.author,
      artist: data.artist ?? null,
      publisher: data.publisher ?? null,
      // Derived from the counts, never taken from the request.
      status: deriveStatus(mangaProgress(data), READ_STATUS),
      totalVolumes: data.totalVolumes ?? null,
      volumesRead: data.volumesRead,
      totalChapters: data.totalChapters ?? null,
      chaptersRead: data.chaptersRead,
      ongoing: data.ongoing,
      language: data.language,
      format: data.format,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(manga, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
