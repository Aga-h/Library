import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const updateArticleSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional().nullable(),
  publication: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  status: z.enum(["READ", "WANT_TO_READ"]).optional(),
  wordCount: z.number().int().positive().optional(),
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

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  return NextResponse.json(article);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateArticleSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const updated = await db.article.update({
    where: { id },
    data: result.data,
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  await db.article.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
