import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey } from "@/lib/calendar-dates";

const createSchema = z.object({
  date: z.string().refine(isDateKey, "Must be a real date (YYYY-MM-DD)"),
  reason: z.string().optional(),
});

async function GETHandler() {
  return NextResponse.json(await db.dayOff.findMany({ orderBy: { date: "asc" } }));
}

async function POSTHandler(request: NextRequest) {
  const result = createSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  try {
    const dayOff = await db.dayOff.create({
      data: { date: fromKey(result.data.date), reason: result.data.reason || null },
    });
    revalidateTag("calendar", "max");
    return NextResponse.json(dayOff, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return NextResponse.json({ error: `${result.data.date} is already marked as a day off` }, { status: 409 });
    }
    throw e;
  }
}

export const GET = withErrors(GETHandler);
export const POST = withErrors(POSTHandler);
