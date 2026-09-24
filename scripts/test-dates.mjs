// Date keys — the one thing every study total is bucketed by. A day boundary that is wrong by
// six hours puts an evening's work on the wrong day, silently.
//
// Run: node --experimental-strip-types scripts/test-dates.mjs
import { toKey, fromKey, addDays, dayOfWeek, isDateKey, todayKey } from "../lib/dates.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

eq(toKey(fromKey("2026-02-28")), "2026-02-28", "round-trip");
eq(addDays("2026-02-28", 1), "2026-03-01", "2026 is not a leap year");
eq(addDays("2024-02-28", 1), "2024-02-29", "2024 is");
eq(addDays("2026-01-01", -1), "2025-12-31", "back across a year");
eq(addDays("2026-12-31", 1), "2027-01-01", "forward across a year");
eq(dayOfWeek("2026-08-19"), 3, "2026-08-19 is a Wednesday");
ok(isDateKey("2026-08-19"), "a real date is a key");
ok(!isDateKey("2026-02-30"), "2026-02-30 is not");
ok(!isDateKey("not-a-date") && !isDateKey("2026-8-19"), "malformed strings are not");

// Keys sort chronologically, which is what the week/month range comparisons rely on.
const sorted = ["2026-12-31", "2026-01-05", "2026-01-15"].sort();
eq(sorted, ["2026-01-05", "2026-01-15", "2026-12-31"], "keys sort chronologically as strings");

// Monday-start week arithmetic, exactly as studyTotals does it.
const mondayOf = (key) => addDays(key, -((dayOfWeek(key) + 6) % 7));
eq(mondayOf("2026-08-19"), "2026-08-17", "Wednesday rolls back to Monday");
eq(mondayOf("2026-08-17"), "2026-08-17", "Monday is its own week start");
eq(mondayOf("2026-08-23"), "2026-08-17", "Sunday belongs to the week that began Monday");

// today is stable and well-formed regardless of the machine's zone
ok(isDateKey(todayKey()), "todayKey is a valid key");
eq(todayKey(new Date("2026-08-19T21:30:00Z")), "2026-08-20",
   "00:30 in Istanbul is already the 20th, though it is still the 19th in UTC");
eq(todayKey(new Date("2026-08-19T20:59:59Z")), "2026-08-19",
   "…and 23:59:59 there is still the 19th");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
