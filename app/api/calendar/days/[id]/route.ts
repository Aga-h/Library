import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  /** When present, replaces the whole set of modules placed in this day. */
  moduleIds: z.array(z.string()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function GETHandler(_r: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const plan = await db.dayPlan.findUnique({
    where: { id },
    include: { modules: { include: { module: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Day not found" }, { status: 404 });
  return NextResponse.json({
    ...plan,
    modules: plan.modules.map((m) => m.module).sort((a, b) => a.startMinute - b.startMinute),
  });
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

  // A placement pointing at a module that does not exist would fail as a foreign-key 500.
  if (d.moduleIds && d.moduleIds.length > 0) {
    const found = await db.eventModule.count({ where: { id: { in: d.moduleIds } } });
    if (found !== new Set(d.moduleIds).size) {
      return NextResponse.json({ error: "One of those modules no longer exists" }, { status: 404 });
    }
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      if (d.moduleIds) {
        // Replace the whole set rather than diffing: the form always sends the full list, and
        // a placement carries nothing of its own that would be lost.
        await tx.dayPlanModule.deleteMany({ where: { planId: id } });
        const unique = [...new Set(d.moduleIds)];
        if (unique.length > 0) {
          await tx.dayPlanModule.createMany({
            data: unique.map((moduleId) => ({ planId: id, moduleId })),
          });
        }
      }
      return tx.dayPlan.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name.trim() } : {}),
          ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        },
        include: { modules: { include: { module: true } } },
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
  // Module placements cascade (the modules themselves survive); assigned dates are emptied,
  // not deleted (SetNull).
  await db.dayPlan.delete({ where: { id } });
  revalidateTag("calendar", "max");
  return new NextResponse(null, { status: 204 });
}

export const GET = withErrors(GETHandler);
export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
