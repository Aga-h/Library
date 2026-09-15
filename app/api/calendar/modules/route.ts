import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { formatRange } from "@/lib/calendar-dates";

const createSchema = z.object({
  title: z.string().min(1, "Name is required"),
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  endMinute: z.number().int().min(0).max(24 * 60).optional().nullable(),
  notes: z.string().optional(),
});

async function GETHandler() {
  return NextResponse.json(
    await db.eventModule.findMany({
      orderBy: [{ startMinute: "asc" }, { title: "asc" }],
      include: { _count: { select: { placements: true } } },
    })
  );
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { startMinute, endMinute, notes } = result.data;
  const title = result.data.title.trim();

  if (endMinute != null && endMinute <= startMinute) {
    return NextResponse.json({ error: "It ends before it starts" }, { status: 400 });
  }

  // Postgres treats NULLs as distinct, so the unique index does not catch two modules that
  // both have no end time. Check explicitly rather than let a duplicate through.
  if (endMinute == null) {
    const clash = await db.eventModule.findFirst({ where: { title, startMinute, endMinute: null } });
    if (clash) {
      return NextResponse.json({ error: `"${title}" at ${formatRange(startMinute, null)} already exists` }, { status: 409 });
    }
  }

  try {
    const created = await db.eventModule.create({
      data: { title, startMinute, endMinute: endMinute ?? null, notes: notes || null },
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `"${title}" at ${formatRange(startMinute, endMinute ?? null)} already exists` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
