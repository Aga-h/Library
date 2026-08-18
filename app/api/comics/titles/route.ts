import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { LANGUAGE_VALUES } from "@/lib/comics";

const createTitleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  universeId: z.string().min(1, "Universe is required"),
  author: z.string().optional(),
  artist: z.string().optional(),
  language: z.enum(LANGUAGE_VALUES).default("ENGLISH"),
  coverImage: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const universeId = searchParams.get("universeId");

  const titles = await db.comicTitle.findMany({
    where: universeId ? { universeId } : {},
    orderBy: { name: "asc" },
  });
  return NextResponse.json(titles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = createTitleSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const name = data.name.trim();

  const universe = await db.comicUniverse.findUnique({ where: { id: data.universeId } });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  try {
    const title = await db.comicTitle.create({
      data: {
        name,
        universeId: data.universeId,
        author: data.author || null,
        artist: data.artist || null,
        language: data.language,
        coverImage: data.coverImage || null,
        notes: data.notes || null,
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(title, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `A comic named "${name}" already exists in ${universe.name}` },
        { status: 409 }
      );
    }
    throw e;
  }
}
