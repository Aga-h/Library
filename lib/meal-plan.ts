/**
 * The diet plan: what to eat on each day, as the user's monthly plan lays it out.
 *
 * Plans live in the repo, one file per month under lib/meal-plans/, rather than in the
 * database: the user sends a new plan each month and it is transcribed here, so there is no
 * migration, no import page and nothing to run by hand. A day with no plan simply shows none.
 *
 * Every number is the plan's own. `total` is written down as the plan states it, and
 * scripts/test-meal-plan.mjs checks it against the sum of the meals, which catches a slip in
 * the transcription.
 */
import type { DateKey } from "@/lib/dates";
import { OCTOBER_2026 } from "@/lib/meal-plans/2026-10";

export type Meal = {
  /** The row's label in the plan: "07:30–08:40", "Lunch", "18:30 dinner". */
  time: string;
  what: string;
  /** null where the plan has "–": nothing to eat then, or nothing counted. */
  kcal: number | null;
  /** Grams. Always an estimate (the plan writes "~"), null where it has "–". */
  protein: number | null;
};

export type MealDay = {
  kind: "rest" | "gym";
  /** A holiday named in the day's heading. */
  occasion?: string;
  /** What the plan says about this day in particular. */
  note?: string;
  /** The plan offers its at-home day instead (weekends, holidays). */
  home?: boolean;
  meals: Meal[];
  total: { kcal: number; protein: number };
};

/** A rule or tip: the plan's bold lead-in, then the rest of the sentence. */
export type PlanNote = { lead: string; text: string };

export type MealPlan = {
  title: string;
  /** kcal a day. */
  target: Record<MealDay["kind"], number>;
  /** Litres a day. */
  water: Record<MealDay["kind"], number>;
  waterNote: string;
  /** Keyed by date. */
  days: Record<DateKey, MealDay>;
  /** The day to eat when home instead of at the cafeteria. Its numbers are estimates. */
  home: { intro: string; meals: Meal[]; total: { kcal: number; protein: number }; tips: PlanNote[] };
  rules: PlanNote[];
};

/** Every plan, oldest first. A new month's plan is added here. */
export const MEAL_PLANS: MealPlan[] = [OCTOBER_2026];

/** The plan covering `date`, with that day, or null when no plan has it. */
export function mealDay(date: DateKey, plans: MealPlan[] = MEAL_PLANS): { plan: MealPlan; day: MealDay } | null {
  for (const plan of plans) {
    const day = plan.days[date];
    if (day) return { plan, day };
  }
  return null;
}

/** How a tick names a meal: its row label, with "home:" in front for the at-home day's rows. */
export const mealKey = (meal: Meal, home = false): string => (home ? `home:${meal.time}` : meal.time);

/** The meals that can be ticked off on a day: its own, and the at-home day's when it offers one. */
export function tickableMeals(day: MealDay, home: MealPlan["home"]): { key: string; meal: Meal }[] {
  return [
    ...day.meals.map((meal) => ({ key: mealKey(meal), meal })),
    ...(day.home ? home.meals.map((meal) => ({ key: mealKey(meal, true), meal })) : []),
  ];
}

/** kcal and protein of the meals ticked off. */
export function eaten(day: MealDay, home: MealPlan["home"], checked: ReadonlySet<string>): { kcal: number; protein: number } {
  let kcal = 0;
  let protein = 0;
  for (const { key, meal } of tickableMeals(day, home)) {
    if (!checked.has(key)) continue;
    kcal += meal.kcal ?? 0;
    protein += meal.protein ?? 0;
  }
  return { kcal, protein };
}

/** The most one water entry may be, in ml: a big bottle, and a typo of 5000 for 500 is refused. */
export const WATER_ENTRY_MAX_ML = 3000;

/** First and last day a plan covers. */
export function planRange(plan: MealPlan): { first: DateKey; last: DateKey } {
  const keys = Object.keys(plan.days).sort() as DateKey[];
  return { first: keys[0], last: keys[keys.length - 1] };
}
