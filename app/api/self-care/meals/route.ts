import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey, todayKey } from "@/lib/dates";
import { mealDay, tickableMeals } from "@/lib/meal-plan";
import {
  EXTRA_KCAL_MAX, EXTRA_LABEL_MAX, EXTRA_PROTEIN_MAX, EXTRAS_MAX, mealOptions, type MealState,
} from "@/lib/meal-adjust";
import { isMissingColumn } from "@/lib/prisma-errors";

const extra = z.object({
  label: z.string().trim().min(1).max(EXTRA_LABEL_MAX),
  kcal: z.number().int().min(1).max(EXTRA_KCAL_MAX),
  protein: z.number().int().min(0).max(EXTRA_PROTEIN_MAX),
});

const schema = z.object({
  date: z.string().refine(isDateKey, "Not a date"),
  meal: z.string().min(1),
  /** What was done with it; null takes the mark off. */
  status: z.enum(["ate", "skipped"]).nullable().optional(),
  /** The add-ons and trims it was eaten with, as the page showed them. */
  changes: z.array(z.string()).max(12).default([]),
  extras: z.array(extra).max(EXTRAS_MAX).default([]),
  /** The tick from before there were choices — the phone widgets and older queued ticks send it. */
  checked: z.boolean().optional(),
}).refine((b) => (b.status === undefined) !== (b.checked === undefined), "Send status or checked");

/**
 * Mark a meal eaten or skipped, or take the mark off. Sets the state rather than flipping it, so a
 * repeated request lands the same. Only today and earlier, only a meal that day's plan has, and
 * only changes that meal can take.
 */
async function PUTHandler(request: Request) {
  const result = schema.safeParse(await readJson(request));
  if (!result.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  const { date, meal, changes, extras, checked } = result.data;
  const status = result.data.status !== undefined ? result.data.status : checked ? "ate" : null;

  if (date > todayKey()) return NextResponse.json({ error: "That day hasn't come yet" }, { status: 400 });
  const found = mealDay(date);
  const row = found && tickableMeals(found.day, found.plan.home).find((t) => t.key === meal);
  if (!row) return NextResponse.json({ error: "That meal isn't in the plan for that day" }, { status: 400 });

  const where = { date: fromKey(date), meal };
  if (status === null) {
    await db.mealCheck.deleteMany({ where });
    return NextResponse.json({ status: null, checked: false });
  }

  const options = new Set(mealOptions(row.meal).map((o) => o.id));
  if (new Set(changes).size !== changes.length || changes.some((id) => !options.has(id))) {
    return NextResponse.json({ error: "That change isn't one this meal can take" }, { status: 400 });
  }
  // A skipped meal has nothing eaten with it.
  const state: MealState = status === "skipped" ? { status, changes: [], extras: [] } : { status, changes, extras };

  try {
    await db.mealCheck.upsert({
      where: { date_meal: where },
      create: { ...where, ...state },
      update: state,
      select: { meal: true },
    });
  } catch (e) {
    if (!isMissingColumn(e)) throw e;
    // Before 041 a meal can only be ticked as eaten, as planned.
    if (status !== "ate" || changes.length || extras.length) {
      return NextResponse.json(
        { error: "Skipping meals and logging extras start once 041-meal-choices.sql has run in Supabase." },
        { status: 503 },
      );
    }
    // Raw, because Prisma writes every column with a default, and these ones aren't there yet.
    await db.$executeRaw`INSERT INTO "MealCheck" ("date", "meal") VALUES (${where.date}::date, ${meal}) ON CONFLICT DO NOTHING`;
  }
  return NextResponse.json({ ...state, checked: status === "ate" });
}

export const PUT = withErrors(PUTHandler);
