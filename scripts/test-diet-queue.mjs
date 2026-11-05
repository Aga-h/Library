// The Diet page's offline queue: what a day looks like with what this device still holds for the
// site laid over the site's last word. Get it wrong and a meal marked at school shows undone, or a
// glass of water counts twice.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-diet-queue.mjs
import { overlay, queuedState, tickId } from "../lib/diet-queue.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

const D = "2026-10-22";
const ATE = { status: "ate", changes: [], extras: [] };
const SKIP = { status: "skipped", changes: [], extras: [] };
const base = { meals: { "11:00": ATE }, water: [{ id: "w1", ml: 500, at: "2026-10-22T06:00:00.000Z" }] };
// A mark as the page queues it now, and a tick as the old page queued it (still in some phones).
const mark = (meal, state, at, date = D) => ({ kind: "meal", id: tickId(date, meal), date, meal, state, at });
const tick = (meal, checked, at, date = D) => ({ kind: "meal", id: tickId(date, meal), date, meal, checked, at });
const glass = (id, ml, at, date = D) => ({ kind: "water", id, date, ml, at });
const statusOf = (meals) => Object.fromEntries(Object.entries(meals).sort().map(([k, s]) => [k, s.status]));
const view = (v) => ({ meals: statusOf(v.meals), water: v.water.map((w) => `${w.id}:${w.ml}${w.pending ? "*" : ""}`) });

eq(view(overlay(base, [], D)), { meals: { "11:00": "ate" }, water: ["w1:500"] }, "nothing queued: the site's word as it is");
eq(view(overlay(base, [mark("Lunch", ATE, "2026-10-22T09:00:00Z")], D)).meals, { "11:00": "ate", Lunch: "ate" }, "a queued mark shows");
eq(view(overlay(base, [mark("Lunch", SKIP, "2026-10-22T09:00:00Z")], D)).meals, { "11:00": "ate", Lunch: "skipped" }, "…a skip too");
eq(view(overlay(base, [mark("11:00", null, "2026-10-22T09:00:00Z")], D)).meals, {}, "a queued unmark shows the meal open");
eq(view(overlay(base, [mark("Lunch", SKIP, "2026-10-22T10:00:00Z"), mark("Lunch", ATE, "2026-10-22T09:00:00Z")], D)).meals,
  { "11:00": "ate", Lunch: "skipped" }, "the later of two marks wins, whatever order they come out of the store in");
{
  const more = { status: "ate", changes: ["whey-one"], extras: [{ label: "A slice of bread", kcal: 75, protein: 2 }] };
  eq(overlay(base, [mark("21:00", more, "2026-10-22T19:00:00Z")], D).meals["21:00"], more, "a mark keeps its changes and extras");
}
// Ticks queued by the page before the choices came in still count, as eaten or unticked.
eq(view(overlay(base, [tick("Lunch", true, "2026-10-22T09:00:00Z")], D)).meals, { "11:00": "ate", Lunch: "ate" }, "an old queued tick shows eaten");
eq(view(overlay(base, [tick("11:00", false, "2026-10-22T09:00:00Z")], D)).meals, {}, "an old queued untick shows open");
eq(queuedState(tick("Lunch", true, "x")), ATE, "an old tick is a plain eaten mark");
eq(queuedState(tick("Lunch", false, "x")), null, "…and an untick takes the mark off");
eq(view(overlay(base, [mark("Lunch", ATE, "2026-10-21T09:00:00Z", "2026-10-21")], D)).meals, { "11:00": "ate" }, "another day's mark leaves this day alone");
eq(view(overlay(base, [glass("q1", 250, "2026-10-22T09:00:00Z")], D)).water, ["w1:500", "q1:250*"], "queued water shows, marked as on this device");
eq(view(overlay(base, [glass("w1", 500, "2026-10-22T06:00:00Z")], D)).water, ["w1:500"],
  "water the site already has (sent, answer lost) shows once, as the site's");
eq(view(overlay(base, [glass("q2", 330, "2026-10-21T09:00:00Z", "2026-10-21")], D)).water, ["w1:500"], "another day's water stays on that day");
eq(view(overlay({ meals: {}, water: [] }, [mark("Lunch", ATE, "2026-10-22T09:00:00Z"), glass("q1", 250, "2026-10-22T09:01:00Z")], D)),
  { meals: { Lunch: "ate" }, water: ["q1:250*"] }, "a day this device has never heard from the site: the queue alone");
eq(tickId(D, "18:30 dinner"), "meal:2026-10-22:18:30 dinner", "one queue slot per meal and day");
eq(tickId(D, "Lunch") === tickId("2026-10-23", "Lunch"), false, "…so the same meal on two days are two slots");
eq(overlay(base, [], D).meals === base.meals, false, "each view is its own copy, so the page can change it");
eq(view(overlay(base, [mark("11:00", null, "2026-10-22T09:00:00Z")], D)) && Object.keys(base.meals), ["11:00"], "…and the site's word underneath is left as it was");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
