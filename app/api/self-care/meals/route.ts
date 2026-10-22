import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey, todayKey } from "@/lib/dates";
import { mealDay, tickableMeals } from "@/lib/meal-plan";

const schema = z.object({
  date: z.string().refine(isDateKey, "Not a date"),
  meal: z.string().min(1),
  checked: z.boolean(),
});

/**
 * Tick a meal off, or un-tick it. Sets the state rather than flipping it, so a repeated request
 * lands the same. Only today and earlier, and only a meal that day's plan has.
 */
async function PUTHandler(request: Request) {
  const result = schema.safeParse(await readJson(request));
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  const { date, meal, checked } = result.data;

  if (date > todayKey()) return NextResponse.json({ error: "That day hasn't come yet" }, { status: 400 });
  const found = mealDay(date);
  if (!found || !tickableMeals(found.day, found.plan.home).some((t) => t.key === meal)) {
    return NextResponse.json({ error: "That meal isn't in the plan for that day" }, { status: 400 });
  }

  const where = { date: fromKey(date), meal };
  if (checked) {
    await db.mealCheck.upsert({ where: { date_meal: where }, create: where, update: {} });
  } else {
    await db.mealCheck.deleteMany({ where });
  }
  return NextResponse.json({ checked });
}

export const PUT = withErrors(PUTHandler);
