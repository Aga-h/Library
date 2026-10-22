// The Diet page's offline queue: what a day looks like with what this device still holds for the
// site laid over the site's last word. Get it wrong and a tick made at school shows undone, or a
// glass of water counts twice.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-diet-queue.mjs
import { overlay, tickId } from "../lib/diet-queue.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}

const D = "2026-10-22";
const base = { checked: ["11:00"], water: [{ id: "w1", ml: 500, at: "2026-10-22T06:00:00.000Z" }] };
const tick = (meal, checked, at, date = D) => ({ kind: "meal", id: tickId(date, meal), date, meal, checked, at });
const glass = (id, ml, at, date = D) => ({ kind: "water", id, date, ml, at });
const view = (v) => ({ checked: [...v.checked].sort(), water: v.water.map((w) => `${w.id}:${w.ml}${w.pending ? "*" : ""}`) });

eq(view(overlay(base, [], D)), { checked: ["11:00"], water: ["w1:500"] }, "nothing queued: the site's word as it is");
eq(view(overlay(base, [tick("Lunch", true, "2026-10-22T09:00:00Z")], D)).checked, ["11:00", "Lunch"], "a queued tick shows ticked");
eq(view(overlay(base, [tick("11:00", false, "2026-10-22T09:00:00Z")], D)).checked, [], "a queued untick shows unticked");
eq(view(overlay(base, [tick("Lunch", false, "2026-10-22T10:00:00Z"), tick("Lunch", true, "2026-10-22T09:00:00Z")], D)).checked,
  ["11:00"], "the later of two ticks wins, whatever order they come out of the store in");
eq(view(overlay(base, [tick("Lunch", true, "2026-10-21T09:00:00Z", "2026-10-21")], D)).checked, ["11:00"], "another day's tick leaves this day alone");
eq(view(overlay(base, [glass("q1", 250, "2026-10-22T09:00:00Z")], D)).water, ["w1:500", "q1:250*"], "queued water shows, marked as on this device");
eq(view(overlay(base, [glass("w1", 500, "2026-10-22T06:00:00Z")], D)).water, ["w1:500"],
  "water the site already has (sent, answer lost) shows once, as the site's");
eq(view(overlay(base, [glass("q2", 330, "2026-10-21T09:00:00Z", "2026-10-21")], D)).water, ["w1:500"], "another day's water stays on that day");
eq(view(overlay({ checked: [], water: [] }, [tick("Lunch", true, "2026-10-22T09:00:00Z"), glass("q1", 250, "2026-10-22T09:01:00Z")], D)),
  { checked: ["Lunch"], water: ["q1:250*"] }, "a day this device has never heard from the site: the queue alone");
eq(tickId(D, "18:30 dinner"), "meal:2026-10-22:18:30 dinner", "one queue slot per meal and day");
eq(tickId(D, "Lunch") === tickId("2026-10-23", "Lunch"), false, "…so the same meal on two days are two slots");
eq(overlay(base, [], D).checked === overlay(base, [], D).checked, false, "each view is its own set, so the page can change it");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
