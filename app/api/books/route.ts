import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";

const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  status: z.enum(["READ", "READING", "WANT_TO_READ", "DNF"]).default("WANT_TO_READ"),
  owned: z.boolean().default(false),
  language: z.enum(LANGUAGE_VALUES)
    .default("ENGLISH"),
  publisher: z.string().optional(),
  pages: z.number().int().positive("Pages must be a positive number"),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesReread: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const language = searchParams.get("language");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (language) where.language = language;

  const books = await db.book.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(books);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createBookSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const book = await db.book.create({
    data: {
      title: data.title,
      author: data.author,
      status: data.status,
      owned: data.owned,
      language: data.language,
      publisher: data.publisher ?? null,
      pages: data.pages,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(book, { status: 201 });
}
