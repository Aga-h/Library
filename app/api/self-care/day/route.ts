import { NextRequest, NextResponse } from "next/server";
import { withErrors } from "@/lib/api-errors";
import { isDateKey, todayKey, type DateKey } from "@/lib/dates";
import { eaten, mealDay, tickableMeals } from "@/lib/meal-plan";
import { dayTracking } from "@/lib/meal-plan-service";

/**
 * A day of the diet plan with what has been ticked and drunk, as JSON — today in Europe/Istanbul
 * unless `?date=YYYY-MM-DD` says otherwise. For the phone widgets, which read it with
 * WIDGET_TOKEN (see proxy.ts). A day with no plan has no meals and no water goal.
 */
async function GETHandler(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("date");
  if (raw !== null && !isDateKey(raw)) {
    return NextResponse.json({ error: "Expected ?date=YYYY-MM-DD" }, { status: 400 });
  }
  const date = (raw ?? todayKey()) as DateKey;
  const found = mealDay(date);
  const tracking = await dayTracking(date);
  const checked = new Set(tracking?.checked);

  return NextResponse.json({
    date,
    kind: found?.day.kind ?? null,
    note: found?.day.note ?? null,
    meals: found
      ? tickableMeals(found.day, found.plan.home).map(({ key, meal }) => ({
          key,
          home: key.startsWith("home:"),
          time: meal.time,
          what: meal.what,
          kcal: meal.kcal,
          protein: meal.protein,
          checked: checked.has(key),
        }))
      : [],
    total: found?.day.total ?? null,
    eaten: found ? eaten(found.day, found.plan.home, checked) : { kcal: 0, protein: 0 },
    water: {
      ml: tracking?.water.reduce((n, w) => n + w.ml, 0) ?? 0,
      goalMl: found ? found.plan.water[found.day.kind] * 1000 : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withErrors(GETHandler);
