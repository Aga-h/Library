// The Diet page's choices: a meal eaten, eaten with more, or skipped, and the rest of the day
// rebalanced around it. Checked against the real plans, so a plan whose rows the rules don't
// recognise (a meal that can take no add-on, a side that isn't found) shows up here.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-meal-adjust.mjs
import { MEAL_PLANS, mealDay, tickableMeals } from "../lib/meal-plan.ts";
import {
  balanceDay, checkedOf, DAY_FLOOR_KCAL, DAY_TOLERANCE_KCAL, dishesOf, eaten, extraPresets, mainDish,
  mealOptions, parseExtras, statesFromChecked,
} from "../lib/meal-adjust.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

const ATE = { status: "ate", changes: [], extras: [] };
const SKIP = { status: "skipped", changes: [], extras: [] };
const ate = (changes = [], extras = []) => ({ status: "ate", changes, extras });
const day = (date) => mealDay(date);
const balance = (date, states) => { const { plan, day: d } = day(date); return balanceDay(d, plan, states); };
const row = (b, key) => b.rows.find((r) => r.key === key);
const ids = (b, key) => row(b, key).changes.map((c) => c.id).sort();
const meal = (date, key) => tickableMeals(day(date).day, day(date).plan.home).find((t) => t.key === key).meal;
const optionIds = (m) => mealOptions(m).map((o) => o.id).sort();

// ─── Reading the menu rows ───────────────────────────────────────────────────

eq(dishesOf("Mercimek çorba (209) + Piliç ızgara/pat.kız. (275) + yoğurt (122) + salad, no oil (40)").map((d) => d.kcal),
  [209, 275, 122, 40], "every bracketed dish, in order");
eq(dishesOf("Nohut (~280, no kcal on the menu) + yoğurt (120) + salad, 1 tsp oil (80)")[0], { name: "Nohut", kcal: 280 },
  "an estimated dish counts too");
eq(dishesOf("Palm-sized chicken breast (~150 g cooked) + vegetables with 1 tsp oil"), [], "portions in grams are not dishes");
eq(mainDish(meal("2026-11-30", "Lunch")), { name: "Hamburger köfte", kcal: 356 }, "the main comes after the soup");
eq(mainDish(meal("2026-11-28", "18:30 dinner")), { name: "Makarna günü", kcal: 380 }, "pasta as the main is the main, not a side");

// ─── What each meal can take ─────────────────────────────────────────────────

eq(optionIds(meal("2026-11-05", "21:00")), ["no-3u1", "whey-half", "whey-one"], "the shake: more whey, or no 3ü1");
eq(optionIds(meal("2026-11-06", "18:30 dinner")),
  ["carb-half", "carb-one", "drop:Mantar çorba", "drop:½ mıs.pirinç pilavı", "no-oil", "yogurt"],
  "a cafeteria dinner with soup and rice: no soup to add; the soup, the rice and the oil can go");
eq(mealOptions(meal("2026-11-06", "18:30 dinner")).find((o) => o.id === "drop:½ mıs.pirinç pilavı").kcal, -125, "a side comes off at its menu kcal");
eq(optionIds(meal("2026-11-06", "Lunch")),
  ["carb-half", "carb-one", "drop:ayran", "drop:½ pirinç pilavı", "soup", "yogurt"],
  "a lunch with ayran: water instead; its salad has no oil to take off");
eq(optionIds(meal("2026-11-28", "18:30 dinner")).includes("drop:Makarna günü"), false, "the main is never dropped");
eq(optionIds(meal("2026-11-07", "home:Dinner")), ["carb-half", "carb-one", "no-oil", "yogurt"], "the at-home dinner: home portions");
eq(mealOptions(meal("2026-11-07", "home:Lunch")).find((o) => o.id === "drop:rice").kcal, -65, "home lunch's half fist of rice is ~65 kcal");
eq(mealOptions(meal("2026-11-16", "Dinner")).find((o) => o.id === "drop:rice").kcal, -150, "the break gym-day dinner's fist is ~150");
eq(optionIds(meal("2026-11-05", "16:00")), ["snack"], "a skipped snack can come back as yoğurt + fruit");
eq(optionIds(meal("2026-11-09", "16:00")), [], "the fruit before training stays as it is");
eq(optionIds(meal("2026-11-05", "11:00")), ["dairy", "no-fruit"], "11:00 with süt + fruit");
eq(optionIds(meal("2026-11-06", "After 16:40")), [], "the gym itself takes nothing");
eq(extraPresets(meal("2026-11-30", "Lunch"))[0], { label: "Seconds of the Hamburger köfte", kcal: 356, protein: 17 },
  "seconds of the main, its protein its share of the meal's");
eq(extraPresets(meal("2026-11-05", "21:00")).some((e) => e.label.startsWith("Seconds")), false, "no seconds of a shake");

// Every meal of every plan: ids unique, add-ons add and trims take, and a trim never adds protein.
for (const plan of MEAL_PLANS) {
  for (const [date, d] of Object.entries(plan.days)) {
    for (const { key, meal: m } of tickableMeals(d, plan.home)) {
      const options = mealOptions(m);
      ok(new Set(options.map((o) => o.id)).size === options.length, `${date} ${key}: option ids are unique`);
      ok(options.every((o) => o.kcal !== 0 && (o.kcal > 0 ? o.protein >= 0 : o.protein <= 0)), `${date} ${key}: add-ons add, trims take`);
    }
    // Every lunch and dinner has something to add, or a skipped meal could never be made up.
    for (const { key, meal: m } of tickableMeals(d, plan.home)) {
      if (m.time === "Lunch" || /dinner/i.test(m.time)) ok(mealOptions(m).some((o) => o.kcal > 0), `${date} ${key}: can take an add-on`);
    }
  }
}

// ─── Rebalancing ─────────────────────────────────────────────────────────────

{
  const b = balance("2026-11-05", {});
  eq([b.moved, b.projected, b.goal], [0, { kcal: 1818, protein: 108 }, { kcal: 1818, protein: 108 }], "nothing marked: the plan as it is");
  ok(b.rows.every((r) => r.changes.length === 0), "…with no changes anywhere");
}
{
  const all = Object.fromEntries(day("2026-11-05").day.meals.map((m) => [m.time, ATE]));
  const b = balance("2026-11-05", all);
  eq([b.eaten, b.moved], [{ kcal: 1818, protein: 108 }, 0], "everything eaten as planned is the day's total");
}
{
  // Thu 5: lunch skipped after the 11:00 snack.
  const b = balance("2026-11-05", { "07:30–08:40": ATE, "11:00": ATE, Lunch: SKIP });
  eq(ids(b, "21:00"), ["whey-one"], "skipped lunch: a scoop more whey in the shake, for the protein");
  eq(ids(b, "18:30 dinner"), ["carb-one", "soup"], "…and dinner takes a portion of rice and the day's soup");
  eq(b.projected.kcal, 1799, "…landing within 50 kcal of 1,818");
  ok(b.projected.protein >= b.goal.protein, "…with the plan's protein made up");
  eq(b.moved, 563, "563 kcal moved onto the meals ahead");
  eq(row(b, "Lunch").kcal, 0, "a skipped meal counts nothing");
}
{
  // Thu 5: a dessert at lunch.
  const b = balance("2026-11-05", { "11:00": ATE, Lunch: ate([], [{ label: "A dessert or cake", kcal: 300, protein: 4 }]) });
  eq(b.eaten.kcal, 458 + 582 + 300, "the dessert counts as eaten");
  eq([ids(b, "21:00"), ids(b, "18:30 dinner")], [["no-3u1"], ["no-oil"]], "a dessert: the 3ü1 and the oil come off");
  eq(b.projected.protein, 108 + 4, "…and no protein with them");
  ok(b.projected.kcal - b.goal.kcal > DAY_TOLERANCE_KCAL, "…still over: nothing else comes off without protein");
}
{
  // Fri 6: the gym skipped.
  const b = balance("2026-11-06", { "07:30–08:40": ATE, "11:00": ATE, Lunch: ATE, "After 16:40": SKIP });
  ok(b.gymSkipped, "skipping the gym is noticed");
  eq(b.goal.kcal, 2000 - 200, "…and the day becomes a rest day's 1,800");
  eq([ids(b, "18:30 dinner"), ids(b, "21:00")], [["drop:½ mıs.pirinç pilavı"], ["no-3u1"]], "…so the rice and the 3ü1 go");
  ok(Math.abs(b.projected.kcal - b.goal.kcal) <= DAY_TOLERANCE_KCAL, "…within 50 kcal of it");
}
eq(balance("2026-11-05", { "07:30–08:40": SKIP }).gymSkipped, false, "skipping something on a rest day isn't skipping the gym");
{
  // Mon 9: dinner skipped, only the shake left.
  const b = balance("2026-11-09", { "11:00": ATE, Lunch: ATE, "16:00": ATE, "18:30 dinner": SKIP });
  eq(ids(b, "21:00"), ["whey-one"], "skipped dinner: what's left takes what it can");
  ok(b.projected.kcal < DAY_FLOOR_KCAL, "…and the day still ends under the 1,700 floor, for the page to say");
}
{
  // An eaten meal keeps what it was eaten with, whatever is marked after it.
  const before = balance("2026-11-05", { "11:00": ATE, Lunch: SKIP });
  const dinner = row(before, "18:30 dinner").changes.map((c) => c.id);
  const after = balance("2026-11-05", { "11:00": ATE, Lunch: SKIP, "18:30 dinner": ate(dinner), "21:00": SKIP });
  eq(ids(after, "18:30 dinner"), [...dinner].sort(), "dinner eaten with its add-ons keeps them");
  eq(row(after, "18:30 dinner").kcal, 443 + 250 + 190, "…and counts them");
  eq(ids(after, "21:00"), [], "a skipped meal takes no changes");
}
eq(row(balance("2026-11-05", { Lunch: ate(["made-up", "yogurt"]) }), "Lunch").changes.map((c) => c.id), ["yogurt"],
  "a change the meal can't take is ignored");
eq(balance("2026-11-05", { Brunch: ATE }).eaten, { kcal: 0, protein: 0 }, "a meal the day doesn't have is ignored");
{
  // Sat 7 at home.
  const b = balance("2026-11-07", { "home:Breakfast": ATE, "home:Lunch": SKIP });
  ok(b.followHome, "marking an at-home meal follows the at-home day");
  eq(b.goal, { kcal: 1810, protein: 155 }, "…whose total is the goal");
  ok(b.rows.filter((r) => !r.home).every((r) => !r.counted && r.changes.length === 0), "…and the cafeteria rows drop out");
  ok(Math.abs(b.projected.kcal - b.goal.kcal) <= DAY_TOLERANCE_KCAL, "a skipped lunch at home is made up at home");
  const mixed = balance("2026-11-07", { Lunch: ATE, "home:Dinner": ATE });
  eq(mixed.eaten.kcal, 462 + 560, "lunch at the cafeteria and dinner at home both count");
}
eq(balance("2026-11-07", { Lunch: ATE }).followHome, false, "a weekend at the cafeteria stays the cafeteria day");
eq(eaten(day("2026-11-05").day, day("2026-11-05").plan, { Lunch: ate(["yogurt"], [{ label: "Bread", kcal: 75, protein: 2 }]) }),
  { kcal: 582 + 122 + 75, protein: 26 + 6 + 2 }, "eaten counts a meal's changes and extras");

// Every day of every plan, with each meal skipped in turn and with 400 kcal eaten on top of each:
// the day ends closer to its plan than it would have, never swings more than the leeway past it,
// and only open meals change.
for (const plan of MEAL_PLANS) {
  for (const [date, d] of Object.entries(plan.days)) {
    for (const { key } of tickableMeals(d, plan.home)) {
      for (const [what, state] of [["skipped", SKIP], ["+400", ate([], [{ label: "x", kcal: 400, protein: 0 }])]]) {
        const b = balanceDay(d, plan, { [key]: state });
        const unbalanced = b.projected.kcal - b.moved - b.goal.kcal;
        const off = b.projected.kcal - b.goal.kcal;
        ok(Math.abs(off) <= Math.max(Math.abs(unbalanced), DAY_TOLERANCE_KCAL),
          `${date} ${key} ${what}: ends ${off} off, no worse than ${unbalanced}`);
        // Add-ons stop short of carrying the day over; trims stop short of carrying it under.
        ok(b.moved > 0 ? off <= DAY_TOLERANCE_KCAL : b.moved < 0 ? off >= -DAY_TOLERANCE_KCAL : true,
          `${date} ${key} ${what}: doesn't swing past the plan (${off})`);
        ok(b.rows.every((r) => r.state === null || r.changes.length === 0 || r.state.status === "ate" && r.state.changes.length),
          `${date} ${key} ${what}: only open meals get changes`);
        // Any change proposed is one the site will accept for that meal.
        ok(b.rows.every((r) => r.changes.every((c) => mealOptions(r.meal).some((o) => o.id === c.id))),
          `${date} ${key} ${what}: proposals are the meal's own options`);
      }
    }
  }
}

// ─── Stored forms ────────────────────────────────────────────────────────────

eq(statesFromChecked(["Lunch"]), { Lunch: ATE }, "an old tick is a meal eaten as planned");
eq(checkedOf({ Lunch: ATE, "21:00": SKIP }), ["Lunch"], "the widgets' ticks are the meals eaten");
eq(parseExtras([{ label: "Bread", kcal: 75, protein: 2 }, { label: "x" }, null, "y"]), [{ label: "Bread", kcal: 75, protein: 2 }],
  "stored extras: anything misshapen is dropped");
eq(parseExtras({}), [], "…and a non-list is none");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
