import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey } from "@/lib/calendar-dates";

/** Set or clear the plan on a single date. `planId: null` clears it. */
const schema = z.object({
  date: z.string().refine(isDateKey, "Must be a real date (YYYY-MM-DD)"),
  planId: z.string().nullable(),
});

async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { date, planId } = result.data;

  if (planId && !(await db.dayPlan.findUnique({ where: { id: planId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const day = await db.calendarDay.upsert({
    where: { date: fromKey(date) },
    create: { date: fromKey(date), planId },
    update: { planId },
  });
  revalidateTag("calendar", "max");
  return NextResponse.json(day);
}

export const POST = withErrors(POSTHandler);
