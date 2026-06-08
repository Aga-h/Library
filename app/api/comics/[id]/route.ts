import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const updateComicSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  universe: z.string().optional().nullable(),
  status: z
    .enum(["READING", "COMPLETED", "PLAN_TO_READ", "DROPPED"])
    .optional(),
  totalIssues: z.number().int().optional().nullable(),
  issuesRead: z.number().int().optional(),
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
  timesReread: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const comic = await db.comic.findUnique({ where: { id } });
  if (!comic) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }
  return NextResponse.json(comic);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const comic = await db.comic.findUnique({ where: { id } });
  if (!comic) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateComicSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.comic.update({
    where: { id },
    data: result.data,
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const comic = await db.comic.findUnique({ where: { id } });
  if (!comic) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  await db.comic.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
