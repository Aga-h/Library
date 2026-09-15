import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const universe = await db.movieUniverse.findUnique({ where: { id } });
  if (!universe) return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  return NextResponse.json(universe);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.movieUniverse.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }
  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;
  try {
    const updated = await db.movieUniverse.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `A universe named "${d.name?.trim()}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.movieUniverse.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }
  // SetNull, not cascade — the films inside survive and return to the main page.
  await db.movieUniverse.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
