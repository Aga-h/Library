import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { MAX_STATS_PER_MODULE, MIN_STATS_PER_MODULE, STATS } from "@/lib/stats";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  stats: z
    .array(z.enum(STATS))
    .min(MIN_STATS_PER_MODULE, "Pick at least one stat")
    .max(MAX_STATS_PER_MODULE, `At most ${MAX_STATS_PER_MODULE} stats`)
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const existing = await db.module.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;
  const title = d.title?.trim();

  try {
    const updated = await db.module.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        // Explicit null clears the note; undefined leaves it alone.
        ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
        ...(d.stats !== undefined ? { stats: [...new Set(d.stats)] } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `"${title}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

/**
 * Deletes a module. Sessions already studied under it are kept — the foreign key is SetNull, and
 * each session carries its own copy of the stats it paid, so history survives intact.
 */
async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const existing = await db.module.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Module not found" }, { status: 404 });

  await db.module.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withErrors(PATCHHandler);
export const DELETE = withErrors(DELETEHandler);
