import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const activitySchema = z.object({
  title: z.string().min(1),
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  endMinute: z.number().int().min(0).max(24 * 60).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  /** When present, replaces the whole timetable — simpler than diffing rows per activity. */
  activities: z.array(activitySchema).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const plan = await db.dayPlan.findUnique({
    where: { id },
    include: { activities: { orderBy: { startMinute: "asc" } } },
  });
  if (!plan) return NextResponse.json({ error: "Day not found" }, { status: 404 });
  return NextResponse.json(plan);
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const existing = await db.dayPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;

  // An activity that ends before it starts is a typo, not a state worth storing.
  const bad = d.activities?.find((a) => a.endMinute != null && a.endMinute <= a.startMinute);
  if (bad) {
    return NextResponse.json({ error: `"${bad.title}" ends before it starts` }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      if (d.activities) {
        await tx.dayActivity.deleteMany({ where: { planId: id } });
        if (d.activities.length > 0) {
          await tx.dayActivity.createMany({
            data: d.activities.map((a) => ({
              planId: id, title: a.title.trim(), startMinute: a.startMinute,
              endMinute: a.endMinute ?? null, notes: a.notes || null,
            })),
          });
        }
      }
      return tx.dayPlan.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name.trim() } : {}),
          ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        },
        include: { activities: { orderBy: { startMinute: "asc" } } },
      });
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      const name = d.name?.trim() || existing.name;
      return NextResponse.json({ error: `A ${existing.kind.toLowerCase()} day named "${name}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

async function DELETEHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  if (!(await db.dayPlan.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }
  // Activities cascade; assigned dates are emptied, not deleted (SetNull).
  await db.dayPlan.delete({ where: { id } });
  revalidateTag("calendar", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
