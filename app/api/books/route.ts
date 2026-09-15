import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";
import { withErrors } from "@/lib/api-errors";
import { deriveStatus, bookProgress, BOOK_STATUS } from "@/lib/derive-status";

const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  owned: z.boolean().default(false),
  language: z.enum(LANGUAGE_VALUES)
    .default("ENGLISH"),
  publisher: z.string().optional(),
  pages: z.number().int().positive("Pages must be a positive number"),
  pagesRead: z.number().int().min(0).default(0),
  coverImage: z.string().url().optional().or(z.literal("")),
  rating: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  timesReread: z.number().int().min(0).default(0),
  seriesId: z.string().optional().nullable(),
});

async function GETHandler(request: NextRequest) {
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

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const result = createBookSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  // A bad series id would otherwise surface as a foreign-key 500.
  if (data.seriesId) {
    const series = await db.bookSeries.findUnique({ where: { id: data.seriesId }, select: { id: true } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  const book = await db.book.create({
    data: {
      title: data.title,
      author: data.author,
      // Derived from the counts, never taken from the request.
      status: deriveStatus(bookProgress(data), BOOK_STATUS),
      owned: data.owned,
      language: data.language,
      publisher: data.publisher ?? null,
      pages: data.pages,
      pagesRead: data.pagesRead,
      coverImage: data.coverImage || null,
      rating: data.rating ?? null,
      notes: data.notes ?? null,
      timesReread: data.timesReread,
      seriesId: data.seriesId || null,
    },
  });

  revalidateTag("library-stats", "max");
  return NextResponse.json(book, { status: 201 });
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
