import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey, todayKey } from "@/lib/dates";
import { WATER_ENTRY_MAX_ML } from "@/lib/meal-plan";

const schema = z.object({
  date: z.string().refine(isDateKey, "Not a date"),
  ml: z.number().int().min(1).max(WATER_ENTRY_MAX_ML),
});

/** Log water drunk on a day: today, or an earlier day you forgot. */
async function POSTHandler(request: Request) {
  const result = schema.safeParse(await readJson(request));
  if (!result.success) {
    return NextResponse.json({ error: `Enter an amount from 1 to ${WATER_ENTRY_MAX_ML} ml` }, { status: 400 });
  }
  const { date, ml } = result.data;
  if (date > todayKey()) return NextResponse.json({ error: "That day hasn't come yet" }, { status: 400 });

  const entry = await db.waterIntake.create({ data: { date: fromKey(date), ml } });
  return NextResponse.json({ id: entry.id, ml: entry.ml, at: entry.createdAt.toISOString() }, { status: 201 });
}

export const POST = withErrors(POSTHandler);
