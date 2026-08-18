import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { LANGUAGE_VALUES } from "@/lib/comics";

const updateTitleSchema = z.object({
  name: z.string().min(1).optional(),
  author: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  language: z.enum(LANGUAGE_VALUES).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const title = await db.comicTitle.findUnique({ where: { id } });
  if (!title) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }
  return NextResponse.json(title);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const title = await db.comicTitle.findUnique({ where: { id } });
  if (!title) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateTitleSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  try {
    const updated = await db.comicTitle.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.author !== undefined ? { author: data.author || null } : {}),
        ...(data.artist !== undefined ? { artist: data.artist || null } : {}),
        ...(data.language !== undefined ? { language: data.language } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `A comic named "${data.name?.trim()}" already exists in this universe` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const title = await db.comicTitle.findUnique({ where: { id } });
  if (!title) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  // Issues below this title go with it (onDelete: Cascade).
  await db.comicTitle.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
