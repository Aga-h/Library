import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ completed: z.boolean() });

/** Tick a unit off, or un-tick it. The tick is a timestamp, so it doubles as "finished on". */
async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }

  const existing = await db.apUnit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  // Re-ticking an already-finished unit keeps the original date rather than moving it.
  const completedAt = result.data.completed ? existing.completedAt ?? new Date() : null;

  const updated = await db.apUnit.update({ where: { id }, data: { completedAt } });
  return NextResponse.json(updated);
}

export const PATCH = withErrors(PATCHHandler);
