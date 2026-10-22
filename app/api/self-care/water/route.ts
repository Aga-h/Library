import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, withErrors } from "@/lib/api-errors";
import { fromKey, isDateKey, todayKey } from "@/lib/dates";
import { WATER_ENTRY_MAX_ML } from "@/lib/meal-plan";
import { isUniqueViolation } from "@/lib/prisma-errors";

const schema = z.object({
  /** Made on the device, so an entry queued offline and sent twice is still logged once. */
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  date: z.string().refine(isDateKey, "Not a date"),
  ml: z.number().int().min(1).max(WATER_ENTRY_MAX_ML),
});

const json = (entry: { id: string; ml: number; createdAt: Date }, status: number) =>
  NextResponse.json({ id: entry.id, ml: entry.ml, at: entry.createdAt.toISOString() }, { status });

/** Log water drunk on a day: today, or an earlier day you forgot. */
async function POSTHandler(request: Request) {
  const result = schema.safeParse(await readJson(request));
  if (!result.success) {
    return NextResponse.json({ error: `Enter an amount from 1 to ${WATER_ENTRY_MAX_ML} ml` }, { status: 400 });
  }
  const { id, date, ml } = result.data;
  if (date > todayKey()) return NextResponse.json({ error: "That day hasn't come yet" }, { status: 400 });

  try {
    return json(await db.waterIntake.create({ data: { id, date: fromKey(date), ml } }), 201);
  } catch (e) {
    // Already logged: the same entry sent again, after an answer that never reached the device.
    if (id && isUniqueViolation(e)) {
      const entry = await db.waterIntake.findUnique({ where: { id } });
      if (entry) return json(entry, 200);
    }
    throw e;
  }
}

export const POST = withErrors(POSTHandler);
