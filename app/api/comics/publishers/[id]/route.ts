import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";

const updatePublisherSchema = z.object({
  name: z.string().min(1).optional(),
  coverImage: z.string().url().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const publisher = await db.comicPublisher.findUnique({ where: { id } });
  if (!publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 });
  }
  return NextResponse.json(publisher);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const publisher = await db.comicPublisher.findUnique({ where: { id } });
  if (!publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 });
  }

  const body = await request.json();
  const result = updatePublisherSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  try {
    const updated = await db.comicPublisher.update({
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
        { error: `A publisher named "${data.name?.trim()}" already exists` },
        { status: 409 }
      );
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const publisher = await db.comicPublisher.findUnique({ where: { id } });
  if (!publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 });
  }

  // Universes, titles and issues below this publisher go with it (onDelete: Cascade).
  await db.comicPublisher.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}
