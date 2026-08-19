import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  // null moves the series out of its universe and back onto the main page.
  universeId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const series = await db.animeSeries.findUnique({ where: { id } });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  return NextResponse.json(series);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  // Keep the row: the 409 message below needs its name when the request carries none.
  const existing = await db.animeSeries.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }
  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;

  if (d.universeId && !(await db.animeUniverse.findUnique({ where: { id: d.universeId } }))) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  try {
    const updated = await db.animeSeries.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.universeId !== undefined ? { universeId: d.universeId || null } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      },
    });
    revalidateTag("library-stats", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Only *attaching* can collide. Detaching never can: the unique is
      // (universeId, name) and Postgres allows repeated NULLs.
      // Fall back to the stored name — a request that only moves the series sends none,
      // which used to render as: A series named "undefined" already exists here.
      const name = d.name?.trim() || existing.name;
      return NextResponse.json({ error: `A series named "${name}" already exists here` }, { status: 409 });
    }
    throw e;
  }
}

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.animeSeries.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }
  // The seasons inside survive and become standalone.
  await db.animeSeries.delete({ where: { id } });
  revalidateTag("library-stats", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
