import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createMangaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  artist: z.string().optional(),
  publisher: z.string().optional(),
  status: z
    .enum(["READING", "COMPLETED", "PLAN_TO_READ", "DROPPED", "ON_HOLD"])
    .default("PLAN_TO_READ"),
  totalVolumes: z.number().int().optional(),
  volumesRead: z.number().int().default(0),
  totalChapters: z.number().int().optional(),
  chaptersRead: z.number().int().default(0),
  language: z
    .enum([
      "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
      "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
      "JAPANESE", "CHINESE", "KOREAN",
    ])
    .default("JAPANESE"),
  format: z.enum(["MANGA", "MANHWA", "MANHUA"]).default("MANGA"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesReread: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
      status: data.status,
      totalVolumes: data.totalVolumes ?? null,
      volumesRead: data.volumesRead,
      totalChapters: data.totalChapters ?? null,
      chaptersRead: data.chaptersRead,
      language: data.language,
      format: data.format,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
    },
  });

  return NextResponse.json(manga, { status: 201 });
}
