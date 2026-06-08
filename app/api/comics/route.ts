import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const createComicSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  artist: z.string().optional(),
  publisher: z.string().optional(),
  universe: z.string().optional(),
  status: z
    .enum(["READING", "COMPLETED", "PLAN_TO_READ", "DROPPED"])
    .default("PLAN_TO_READ"),
  totalIssues: z.number().int().optional(),
  issuesRead: z.number().int().default(0),
  language: z
    .enum([
      "ENGLISH", "SPANISH", "FRENCH", "GERMAN", "ITALIAN",
      "PORTUGUESE", "TURKISH", "ARABIC", "RUSSIAN",
      "JAPANESE", "CHINESE", "KOREAN",
    ])
    .default("ENGLISH"),
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

  const comics = await db.comic.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comics);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createComicSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const comic = await db.comic.create({
    data: {
      title: data.title,
      author: data.author ?? null,
      artist: data.artist ?? null,
      publisher: data.publisher ?? null,
      universe: data.universe ?? null,
      status: data.status,
      totalIssues: data.totalIssues ?? null,
      issuesRead: data.issuesRead,
      language: data.language,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(comic, { status: 201 });
}
