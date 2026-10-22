// Meal plans — transcribed by hand from the user's monthly plan, so these are mostly checksums on
// the transcription: a day's total is the sum of its meals, a meal's kcal is the sum of the dishes
// bracketed in it, no day is missing, and the gym days fall where the plan puts them.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-meal-plan.mjs
import { MEAL_PLANS, mealDay, planRange } from "../lib/meal-plan.ts";
import { addDays, dayOfWeek, isDateKey } from "../lib/dates.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const sum = (meals, field) => meals.reduce((n, m) => n + (m[field] ?? 0), 0);

// Mains, soups, sides and salad carry their menu kcal in brackets: "Mantı (322)". Where a meal
// lists them, they add up to the meal. Estimates like "(~150 g cooked)" are not brackets of kcal.
function checkMeals(meals, total, where) {
  eq(sum(meals, "kcal"), total.kcal, `${where}: kcal total is the sum of the meals`);
  // Protein is an estimate per meal, rounded, so the plan's total can be a gram off the sum.
  const protein = sum(meals, "protein");
  ok(Math.abs(protein - total.protein) <= 1, `${where}: protein total ${total.protein} g is within 1 g of the meals' ${protein} g`);
  for (const m of meals) {
    ok(m.time.trim() !== "" && m.what.trim() !== "", `${where} ${m.time}: has a time and something to eat`);
    const dishes = [...m.what.matchAll(/\((\d+)\)/g)].map((x) => Number(x[1]));
    if (dishes.length) eq(dishes.reduce((a, b) => a + b, 0), m.kcal, `${where} ${m.time}: dishes add up to the meal`);
  }
}

const seen = new Map();
for (const plan of MEAL_PLANS) {
  const keys = Object.keys(plan.days).sort();
  ok(keys.length > 0, `${plan.title}: has days`);
  for (const key of keys) {
    const day = plan.days[key];
    ok(isDateKey(key), `${plan.title}: ${key} is a real date`);
    ok(day.kind === "rest" || day.kind === "gym", `${key}: is a rest or gym day`);
    ok(!seen.has(key), `${key}: only one plan covers it (also in ${seen.get(key)})`);
    seen.set(key, plan.title);
    checkMeals(day.meals, day.total, key);
    // "Every day below lands within about 50 kcal of that."
    ok(Math.abs(day.total.kcal - plan.target[day.kind]) <= 50,
      `${key}: ${day.total.kcal} kcal is within 50 of the ${day.kind}-day target ${plan.target[day.kind]}`);
  }
  // A missing day would just show "no plan" on the site; the plan runs without gaps.
  const { first, last } = planRange(plan);
  for (let k = first; k <= last; k = addDays(k, 1)) ok(plan.days[k], `${plan.title}: ${k} is in the plan`);
  checkMeals(plan.home.meals, plan.home.total, `${plan.title} at home`);
  ok(plan.rules.length > 0, `${plan.title}: has its rules`);
}

// October: gym on Monday, Wednesday and Friday, rest the other four days.
for (const [key, day] of Object.entries(MEAL_PLANS[0].days)) {
  eq(day.kind, [1, 3, 5].includes(dayOfWeek(key)) ? "gym" : "rest", `${key}: gym days are Mon, Wed, Fri`);
}
eq(planRange(MEAL_PLANS[0]), { first: "2026-10-22", last: "2026-10-31" }, "October runs 22–31");
// Weekends offer the at-home day, as does the bank holiday.
for (const key of ["2026-10-24", "2026-10-25", "2026-10-29", "2026-10-31"]) ok(MEAL_PLANS[0].days[key].home, `${key}: offers the at-home day`);
ok(!MEAL_PLANS[0].days["2026-10-22"].home, "a weekday at the cafeteria does not");

// Lookup
eq(mealDay("2026-10-22")?.day.total, { kcal: 1769, protein: 113 }, "Thu 22 Oct is the first day: 1,769 kcal");
eq(mealDay("2026-10-22")?.plan.title, "October Cut Plan", "…from the October plan");
eq(mealDay("2026-10-29")?.day.occasion, "Cumhuriyet Bayramı", "Thu 29 is the bank holiday");
eq(mealDay("2026-10-21"), null, "the day before the plan starts has none");
eq(mealDay("2026-11-01"), null, "neither has the day after it ends");
eq(mealDay("2026-10-22", []), null, "no plans, no day");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
