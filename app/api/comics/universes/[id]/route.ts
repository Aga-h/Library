import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";

const updateUniverseSchema = z.object({
  name: z.string().min(1).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const universe = await db.comicUniverse.findUnique({ where: { id } });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }
  return NextResponse.json(universe);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const universe = await db.comicUniverse.findUnique({ where: { id } });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updateUniverseSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  try {
    const updated = await db.comicUniverse.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json(
        { error: `A universe named "${data.name?.trim()}" already exists under this publisher` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const universe = await db.comicUniverse.findUnique({ where: { id } });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  // Titles and issues below this universe go with it (onDelete: Cascade).
  await db.comicUniverse.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
