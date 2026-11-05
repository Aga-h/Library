import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { mealDay } from "@/lib/meal-plan";
import { balanceDay } from "@/lib/meal-adjust";
import { dayTracking } from "@/lib/meal-plan-service";

/**
 * A day of the diet plan with what has been eaten, skipped and drunk, and the open meals
 * rebalanced around it, as JSON — today in Europe/Istanbul
 * unless `?date=YYYY-MM-DD` says otherwise. The Diet page reads it after syncing what it queued
 * offline; the phone widgets read it with WIDGET_TOKEN (see proxy.ts). A day with no plan has no
 * meals and no water goal.
 */
async function GETHandler(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("date");
  if (raw !== null && !isDateKey(raw)) {
    return NextResponse.json({ error: "Expected ?date=YYYY-MM-DD" }, { status: 400 });
  }
  const date = (raw ?? todayKey()) as DateKey;
  const found = mealDay(date);
  const tracking = await dayTracking(date);
  const day = found ? balanceDay(found.day, found.plan, tracking?.meals ?? {}) : null;

  return NextResponse.json({
    date,
    kind: found?.day.kind ?? null,
    note: found?.day.note ?? null,
    meals: day
      ? day.rows.map(({ key, home, meal, state, changes, kcal, protein, counted }) => ({
          key,
          home,
          time: meal.time,
          what: meal.what,
          /** The plan's figures. */
          kcal: meal.kcal,
          protein: meal.protein,
          /** "ate", "skipped", or null while still open. `checked` is "ate", for the widgets. */
          status: state?.status ?? null,
          checked: state?.status === "ate",
          extras: state?.extras ?? [],
          /** Eaten with it, or proposed for it while open. */
          changes: changes.map(({ id, label, kcal, protein }) => ({ id, label, kcal, protein })),
          /** What it comes to with them. */
          now: { kcal, protein },
          counted,
        }))
      : [],
    total: found?.day.total ?? null,
    goal: day?.goal ?? null,
    projected: day?.projected ?? null,
    eaten: day?.eaten ?? { kcal: 0, protein: 0 },
    choices: tracking?.choices ?? false,
    water: {
      entries: tracking?.water ?? [],
      ml: tracking?.water.reduce((n, w) => n + w.ml, 0) ?? 0,
      goalMl: found ? found.plan.water[found.day.kind] * 1000 : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withErrors(GETHandler);
