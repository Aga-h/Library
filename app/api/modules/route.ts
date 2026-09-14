import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_STATS_PER_MODULE, MIN_STATS_PER_MODULE, MODULE_COLORS, STATS } from "@/lib/stats";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  color: z.enum(MODULE_COLORS).default("SLATE"),
  stats: z.array(z.enum(STATS)).min(MIN_STATS_PER_MODULE).max(MAX_STATS_PER_MODULE),
  archived: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("archived") === "true";
  const modules = await db.module.findMany({
    where: includeArchived ? undefined : { archived: false },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(modules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const d = result.data;
  const stats = [...new Set(d.stats)];
  if (stats.length < MIN_STATS_PER_MODULE) {
    return NextResponse.json({ error: "Pick at least one stat" }, { status: 400 });
  }
  const created = await db.module.create({
    data: {
      name: d.name.trim(),
      description: d.description?.trim() || null,
      color: d.color,
      stats,
      archived: d.archived,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
