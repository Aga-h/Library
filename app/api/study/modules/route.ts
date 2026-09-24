import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { MAX_STATS_PER_MODULE, MIN_STATS_PER_MODULE, STATS } from "@/lib/stats";

const createSchema = z.object({
  title: z.string().min(1, "Name is required"),
  notes: z.string().optional().nullable(),
  stats: z
    .array(z.enum(STATS))
    .min(MIN_STATS_PER_MODULE, "Pick at least one stat")
    .max(MAX_STATS_PER_MODULE, `At most ${MAX_STATS_PER_MODULE} stats`),
});

async function GETHandler() {
  return NextResponse.json(
    await db.module.findMany({
      orderBy: { title: "asc" },
      include: { _count: { select: { sessions: true } } },
    }),
  );
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const title = result.data.title.trim();
  // A list of the same stat twice would pay it twice.
  const stats = [...new Set(result.data.stats)];

  try {
    const created = await db.module.create({
      data: { title, notes: result.data.notes?.trim() || null, stats },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `"${title}" already exists` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
