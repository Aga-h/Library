import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";

const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  publication: z.string().optional(),
  url: z.string().url().optional(),
  status: z
    .enum(["READ", "WANT_TO_READ"])
    .default("WANT_TO_READ"),
  wordCount: z.number().int().positive("Word count is required"),
  language: z.enum(LANGUAGE_VALUES)
    .default("ENGLISH"),
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

  const articles = await db.article.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(articles);
}

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createArticleSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const article = await db.article.create({
    data: {
      title: data.title,
      author: data.author ?? null,
      publication: data.publication ?? null,
      url: data.url ?? null,
      status: data.status,
      wordCount: data.wordCount,
      language: data.language,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(article, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
