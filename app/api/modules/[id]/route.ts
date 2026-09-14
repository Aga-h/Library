import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_STATS_PER_MODULE, MIN_STATS_PER_MODULE, MODULE_COLORS, STATS } from "@/lib/stats";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  color: z.enum(MODULE_COLORS).optional(),
  stats: z.array(z.enum(STATS)).min(MIN_STATS_PER_MODULE).max(MAX_STATS_PER_MODULE).optional(),
  archived: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const mod = await db.module.findUnique({ where: { id } });
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });
  return NextResponse.json(mod);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;
  const updated = await db.module.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
      ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
      ...(d.color !== undefined ? { color: d.color } : {}),
      ...(d.stats !== undefined ? { stats: [...new Set(d.stats)] } : {}),
      ...(d.archived !== undefined ? { archived: d.archived } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  await db.module.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
