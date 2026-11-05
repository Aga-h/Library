import { db } from "@/lib/db";
import { fromKey, type DateKey } from "@/lib/dates";
import { isMissingColumn, isMissingTable } from "@/lib/prisma-errors";
import { parseExtras, statesFromChecked, type MealStates } from "@/lib/meal-adjust";

export type WaterEntry = { id: string; ml: number; /** When it was logged, an ISO instant. */ at: string };
/**
 * What was done on a day: each meal marked (eaten or skipped) and the water drunk. `choices` is
 * false until migration 041 has run: meals can then only be ticked as eaten.
 */
export type DayTracking = { meals: MealStates; water: WaterEntry[]; choices?: boolean };

/**
 * The meals marked and the water drunk on a day. Null until migration 038 has run, so the Diet
 * page can still show the plan without them.
 */
export async function dayTracking(date: DateKey): Promise<DayTracking | null> {
  try {
    const [meals, water] = await Promise.all([
      mealStates(date),
      db.waterIntake.findMany({ where: { date: fromKey(date) }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      ...meals,
      water: water.map((w) => ({ id: w.id, ml: w.ml, at: w.createdAt.toISOString() })),
    };
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

async function mealStates(date: DateKey): Promise<{ meals: MealStates; choices: boolean }> {
  try {
    const rows = await db.mealCheck.findMany({
      where: { date: fromKey(date) },
      select: { meal: true, status: true, changes: true, extras: true },
    });
    const meals: MealStates = {};
    for (const r of rows) {
      meals[r.meal] = r.status === "skipped"
        ? { status: "skipped", changes: [], extras: [] }
        : { status: "ate", changes: r.changes ?? [], extras: parseExtras(r.extras) };
    }
    return { meals, choices: true };
  } catch (e) {
    // Before 041: every row is a tick.
    if (!isMissingColumn(e)) throw e;
    const rows = await db.mealCheck.findMany({ where: { date: fromKey(date) }, select: { meal: true } });
    return { meals: statesFromChecked(rows.map((r) => r.meal)), choices: false };
  }
}
