import { db } from "@/lib/db";
import { fromKey, type DateKey } from "@/lib/dates";
import { isMissingTable } from "@/lib/prisma-errors";

export type WaterEntry = { id: string; ml: number; /** When it was logged, an ISO instant. */ at: string };
export type DayTracking = { checked: string[]; water: WaterEntry[] };

/**
 * The meals ticked off and the water drunk on a day. Null until migration 038 has run, so the
 * Diet page can still show the plan without them.
 */
export async function dayTracking(date: DateKey): Promise<DayTracking | null> {
  try {
    const [checks, water] = await Promise.all([
      db.mealCheck.findMany({ where: { date: fromKey(date) }, select: { meal: true } }),
      db.waterIntake.findMany({ where: { date: fromKey(date) }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      checked: checks.map((c) => c.meal),
      water: water.map((w) => ({ id: w.id, ml: w.ml, at: w.createdAt.toISOString() })),
    };
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}
