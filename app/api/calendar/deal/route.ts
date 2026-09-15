import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrors } from "@/lib/api-errors";
import { datesInMonth, fromKey, toKey, isWeekend, type DateKey } from "@/lib/calendar-dates";
import { dealPlans, deriveKind } from "@/lib/calendar-shuffle";
import { loadContext, plansByKind } from "@/lib/calendar";

const schema = z.object({
  year: z.number().int().min(1970).max(2200),
  month: z.number().int().min(1).max(12),
  /** "fill" leaves assigned dates alone; "redeal" replaces every date in the month. */
  mode: z.enum(["fill", "redeal"]),
});

async function POSTHandler(request: NextRequest) {
  const result = schema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 400 });
  }
  const { year, month, mode } = result.data;
  const dates = datesInMonth(year, month);

  const [context, pools, assigned] = await Promise.all([
    loadContext(),
    plansByKind(),
    db.calendarDay.findMany({
      where: { date: { gte: fromKey(dates[0]), lte: fromKey(dates[dates.length - 1]) }, planId: { not: null } },
      select: { date: true },
    }),
  ]);

  const { assignments, skipped } = dealPlans({
    dates,
    kindOf: (d: DateKey) => deriveKind(d, { isWeekend, terms: context.terms, daysOff: context.daysOff }),
    plansByKind: pools,
    existing: new Set(assigned.map((a) => toKey(a.date))),
    mode,
    rng: Math.random,
  });

  // One upsert per assigned date, in a transaction so a month is dealt all-or-nothing.
  await db.$transaction(
    [...assignments].map(([date, planId]) =>
      db.calendarDay.upsert({
        where: { date: fromKey(date) },
        create: { date: fromKey(date), planId },
        update: { planId },
      })
    )
  );

  revalidateTag("calendar", "max");

  // Report what could not be dealt rather than silently leaving gaps.
  const missingKinds = [...new Set(skipped.map((s) => s.kind))];
  return NextResponse.json({
    assigned: assignments.size,
    skipped: skipped.length,
    message: missingKinds.length
      ? `Dealt ${assignments.size} days. ${skipped.length} left empty — you have no ${missingKinds.map((k) => k.toLowerCase()).join(" or ")} days yet.`
      : `Dealt ${assignments.size} days.`,
  });
}

export const POST = withErrors(POSTHandler);
