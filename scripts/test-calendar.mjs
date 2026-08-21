// Exhaustive check of the calendar's two pure rules: what kind a date is, and how plans are
// dealt onto dates. Both decide what the user sees every day, so they earn real coverage.
//
// Run: node --experimental-strip-types scripts/test-calendar.mjs
import {
  toKey, fromKey, addDays, dayOfWeek, isWeekend, isWithin,
  datesInMonth, monthGrid, keyMonth, isDateKey, todayKey,
} from "../lib/calendar-dates.ts";
import { dealPlans, deriveKind, shuffled } from "../lib/calendar-shuffle.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// A deterministic RNG, so "random" behaviour is actually assertable.
function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// ── dates ────────────────────────────────────────────────────────────────────
eq(toKey(fromKey("2026-02-28")), "2026-02-28", "round-trip");
eq(addDays("2026-02-28", 1), "2026-03-01", "2026 is not a leap year");
eq(addDays("2024-02-28", 1), "2024-02-29", "2024 is");
eq(addDays("2026-01-01", -1), "2025-12-31", "back across a year");
eq(addDays("2026-12-31", 1), "2027-01-01", "forward across a year");
eq(dayOfWeek("2026-08-19"), 3, "2026-08-19 is a Wednesday");
ok(isWeekend("2026-08-22") && isWeekend("2026-08-23"), "Sat and Sun are weekend");
ok(!isWeekend("2026-08-21") && !isWeekend("2026-08-24"), "Fri and Mon are not");
eq(datesInMonth(2026, 2).length, 28, "Feb 2026 has 28 days");
eq(datesInMonth(2024, 2).length, 29, "Feb 2024 has 29");
eq(datesInMonth(2026, 12).at(-1), "2026-12-31", "December ends on the 31st");
eq(datesInMonth(2026, 8)[0], "2026-08-01", "months are zero-padded");
ok(isWithin("2026-05-05", "2026-05-01", "2026-05-31"), "inside a range");
ok(isWithin("2026-05-01", "2026-05-01", "2026-05-31"), "range start is inclusive");
ok(isWithin("2026-05-31", "2026-05-01", "2026-05-31"), "range end is inclusive");
ok(!isWithin("2026-06-01", "2026-05-01", "2026-05-31"), "outside a range");
ok(isDateKey("2026-08-19"), "a real date is a key");
ok(!isDateKey("2026-02-30"), "2026-02-30 is not");
ok(!isDateKey("not-a-date") && !isDateKey("2026-8-19"), "malformed strings are not");

const grid = monthGrid(2026, 8);
eq(grid.length, 42, "the grid is 6 weeks");
eq(dayOfWeek(grid[0]), 1, "the grid starts on a Monday");
ok(grid.includes("2026-08-01") && grid.includes("2026-08-31"), "the grid covers the month");
ok(grid.some((k) => keyMonth(k) !== 8), "the grid includes padding from neighbouring months");

// today is stable and well-formed regardless of the machine's zone
ok(isDateKey(todayKey()), "todayKey is a valid key");
eq(todayKey(new Date("2026-08-19T21:30:00Z")), "2026-08-20",
   "22:30 in Istanbul on the 19th UTC is already the 20th there");

// ── deriveKind ───────────────────────────────────────────────────────────────
const terms = [{ startDate: "2026-09-01", endDate: "2026-12-20" }];
const daysOff = new Set(["2026-10-29"]);
const k = (d) => deriveKind(d, { isWeekend, terms, daysOff });
eq(k("2026-09-02"), "SCHOOL", "a weekday inside term is school");
eq(k("2026-08-05"), "HOLIDAY", "a weekday outside term is holiday");
eq(k("2026-10-29"), "HOLIDAY", "a marked day off is holiday even inside term");
eq(k("2026-09-05"), "HOLIDAY", "a Saturday inside term is still holiday");
eq(k("2026-09-06"), "HOLIDAY", "and so is the Sunday");
eq(k("2026-09-01"), "SCHOOL", "the first day of term is school");
eq(k("2026-12-21"), "HOLIDAY", "the day after term ends is holiday");

// ── dealPlans ────────────────────────────────────────────────────────────────
const holidayOnly = () => "HOLIDAY";
const march = datesInMonth(2026, 3); // 31 dates

// every plan used before any repeats
{
  const plans = ["a", "b", "c", "d"];
  const { assignments } = dealPlans({
    dates: march, kindOf: holidayOnly,
    plansByKind: { HOLIDAY: plans, SCHOOL: [] },
    existing: new Set(), mode: "fill", rng: seededRng(7),
  });
  eq(assignments.size, 31, "every date got a plan");
  const seq = march.map((d) => assignments.get(d));
  let clean = true;
  for (let i = 0; i < seq.length; i += 4) {
    const block = seq.slice(i, i + 4);
    if (block.length === 4 && new Set(block).size !== 4) clean = false;
  }
  ok(clean, "each run of 4 uses all 4 plans exactly once");
  const counts = plans.map((p) => seq.filter((x) => x === p).length);
  ok(Math.max(...counts) - Math.min(...counts) <= 1, `evenly spread, got ${counts}`);
}

// degenerate pools
{
  const one = dealPlans({
    dates: march, kindOf: holidayOnly, plansByKind: { HOLIDAY: ["solo"], SCHOOL: [] },
    existing: new Set(), mode: "fill", rng: seededRng(1),
  });
  ok([...one.assignments.values()].every((v) => v === "solo"), "one plan covers every date");
  eq(one.skipped.length, 0, "and nothing is skipped");

  const none = dealPlans({
    dates: march, kindOf: holidayOnly, plansByKind: { HOLIDAY: [], SCHOOL: [] },
    existing: new Set(), mode: "fill", rng: seededRng(1),
  });
  eq(none.assignments.size, 0, "no plans means no assignments");
  eq(none.skipped.length, 31, "and every date is reported as skipped, not thrown");

  const many = dealPlans({
    dates: march.slice(0, 3), kindOf: holidayOnly,
    plansByKind: { HOLIDAY: ["a","b","c","d","e","f","g"], SCHOOL: [] },
    existing: new Set(), mode: "fill", rng: seededRng(3),
  });
  eq(many.assignments.size, 3, "more plans than dates is fine");
  eq(new Set(many.assignments.values()).size, 3, "and they are all different");
}

// fill vs redeal
{
  const existing = new Set(["2026-03-01", "2026-03-02"]);
  const fill = dealPlans({
    dates: march, kindOf: holidayOnly, plansByKind: { HOLIDAY: ["a","b"], SCHOOL: [] },
    existing, mode: "fill", rng: seededRng(9),
  });
  ok(!fill.assignments.has("2026-03-01") && !fill.assignments.has("2026-03-02"),
     "fill leaves existing assignments completely alone");
  eq(fill.assignments.size, 29, "and fills only the other 29");

  const redeal = dealPlans({
    dates: march, kindOf: holidayOnly, plansByKind: { HOLIDAY: ["a","b"], SCHOOL: [] },
    existing, mode: "redeal", rng: seededRng(9),
  });
  eq(redeal.assignments.size, 31, "redeal covers every date including the taken ones");
}

// mixed kinds draw from their own decks and never cross over
{
  const mixed = dealPlans({
    dates: datesInMonth(2026, 9), kindOf: k,
    plansByKind: { SCHOOL: ["s1","s2"], HOLIDAY: ["h1","h2","h3"] },
    existing: new Set(), mode: "fill", rng: seededRng(11),
  });
  let correct = true;
  for (const [date, plan] of mixed.assignments) {
    const want = k(date) === "SCHOOL" ? ["s1","s2"] : ["h1","h2","h3"];
    if (!want.includes(plan)) correct = false;
  }
  ok(correct, "every date got a plan of its own kind");
  const sat = "2026-09-05";
  ok(["h1","h2","h3"].includes(mixed.assignments.get(sat)),
     "a weekend inside term drew from the holiday deck");
}

// one kind empty, the other not
{
  const half = dealPlans({
    dates: datesInMonth(2026, 9), kindOf: k,
    plansByKind: { SCHOOL: [], HOLIDAY: ["h1"] },
    existing: new Set(), mode: "fill", rng: seededRng(5),
  });
  ok(half.skipped.every((s) => s.kind === "SCHOOL"), "only school dates were skipped");
  ok(half.skipped.length > 0 && half.assignments.size > 0, "holiday dates still got dealt");
}

// shuffled() does not mutate its input
{
  const src = ["a","b","c","d","e"];
  const copy = src.slice();
  shuffled(src, seededRng(2));
  eq(src, copy, "shuffled leaves the original array untouched");
}

console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.error("  ✗ " + f); process.exit(1); }
