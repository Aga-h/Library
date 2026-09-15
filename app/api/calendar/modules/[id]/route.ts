import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { formatRange } from "@/lib/calendar-dates";
import { MAX_STATS_PER_MODULE, STATS } from "@/lib/stats";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  startMinute: z.number().int().min(0).max(24 * 60 - 1).optional(),
  endMinute: z.number().int().min(0).max(24 * 60).optional().nullable(),
  notes: z.string().optional().nullable(),
  // Up to three. An empty list is valid: the module stays an ordinary calendar event.
  stats: z.array(z.enum(STATS)).max(MAX_STATS_PER_MODULE).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const existing = await db.eventModule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;

  // Editing a module changes it in every day it is placed in — that is the point of modules,
  // so the check below is about validity, not about protecting other days from the change.
  const start = d.startMinute ?? existing.startMinute;
  const end = d.endMinute !== undefined ? d.endMinute : existing.endMinute;
  if (end != null && end <= start) {
    return NextResponse.json({ error: "It ends before it starts" }, { status: 400 });
  }

  try {
    const updated = await db.eventModule.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title.trim() } : {}),
        ...(d.startMinute !== undefined ? { startMinute: d.startMinute } : {}),
        ...(d.endMinute !== undefined ? { endMinute: d.endMinute } : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.stats !== undefined ? { stats: [...new Set(d.stats)] } : {}),
      },
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      const title = d.title?.trim() || existing.title;
      return NextResponse.json({ error: `"${title}" at ${formatRange(start, end)} already exists` }, { status: 409 });
    }
    throw e;
  }
}

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const existing = await db.eventModule.findUnique({
    where: { id },
    include: { _count: { select: { placements: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  // Placements cascade, so deleting a module removes it from every day that used it. The UI
  // says how many that is before asking.
  await db.eventModule.delete({ where: { id } });
  revalidateTag("calendar", "max");
  return new NextResponse(null, { status: 204 });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
