// Weekly goals. The number that matters is "what each remaining day needs": it must never ask for
// less than what is actually left, and today has to count as a day you can still study.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-goals.mjs
import { goalProgress, hoursToMinutes, minutesToHours, paceText, MAX_WEEKLY_GOAL_HOURS } from "../lib/goals.ts";
import { formatDuration } from "../lib/study.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── hours in, minutes stored ─────────────────────────────────────────────────
eq(hoursToMinutes(20), 1200, "20 hours");
eq(hoursToMinutes(7.5), 450, "half hours are exact");
eq(hoursToMinutes(0.25), 15, "a quarter of an hour");
eq(hoursToMinutes(1 / 3), 20, "a third of an hour rounds to the minute");
eq(hoursToMinutes(0.001), 0, "a sliver rounds to nothing — the API refuses it as a goal");
eq(minutesToHours(450), 7.5, "back to hours for the input box");
eq(minutesToHours(20), 0.33, "…to two decimals");
eq(minutesToHours(hoursToMinutes(12.75)), 12.75, "a typed value survives the round trip");
eq(MAX_WEEKLY_GOAL_HOURS, 168, "a week is 168 hours");

// ── progress mid-week ────────────────────────────────────────────────────────
// Thursday 24 Sep 2026: Thu, Fri, Sat, Sun left — 4 days, today included.
const thu = goalProgress(1200, 12.5 * 3600, "2026-09-24");
eq(thu.goalSeconds, 72000, "20h goal in seconds");
eq(thu.remainingSeconds, 27000, "7h 30m to go");
eq(thu.daysLeft, 4, "Thursday leaves four days, counting today");
eq(thu.perDaySeconds, 6750, "7h 30m over 4 days is 1h 52m 30s a day");
eq(thu.fraction, 0.625, "the bar is 62.5% full");
eq(thu.met, false, "not met yet");

// ── the ends of the week ─────────────────────────────────────────────────────
const mon = goalProgress(1200, 0, "2026-09-21");
eq(mon.daysLeft, 7, "Monday morning: the whole week is ahead");
eq(mon.perDaySeconds, Math.ceil(72000 / 7), "…so the daily need is a seventh of the goal");
const sun = goalProgress(1200, 18 * 3600, "2026-09-27");
eq(sun.daysLeft, 1, "Sunday is the last day");
eq(sun.perDaySeconds, 7200, "…and it has to carry everything left");

// ── met, and past it ─────────────────────────────────────────────────────────
const exact = goalProgress(60, 3600, "2026-09-24");
eq([exact.met, exact.remainingSeconds, exact.perDaySeconds], [true, 0, null], "exactly the goal counts as met");
const short = goalProgress(60, 3599, "2026-09-24");
eq([short.met, short.remainingSeconds, short.perDaySeconds], [false, 1, 1], "one second short is not met");
const over = goalProgress(60, 5400, "2026-09-24");
eq([over.met, over.fraction, over.doneSeconds], [true, 1, 5400], "past the goal: the bar stops full, the real total is kept");

// ── nonsense in, sense out ───────────────────────────────────────────────────
const neg = goalProgress(60, -100, "2026-09-24");
eq([neg.doneSeconds, neg.remainingSeconds], [0, 3600], "negative time is treated as none");
eq(goalProgress(0, 500, "2026-09-24").fraction, 0, "a zero goal draws an empty bar rather than dividing by zero");

// ── the per-day figure never under-asks ──────────────────────────────────────
const week = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
for (const day of week) {
  for (let done = 0; done <= 20 * 3600; done += 1237) {
    const p = goalProgress(1200, done, day);
    if (p.met) continue;
    ok(p.perDaySeconds * p.daysLeft >= p.remainingSeconds,
      `${day}, ${done}s done: ${p.perDaySeconds}s × ${p.daysLeft} days covers ${p.remainingSeconds}s`);
    ok(p.perDaySeconds * p.daysLeft < p.remainingSeconds + p.daysLeft,
      `${day}, ${done}s done: rounding up adds under a second a day`);
  }
}

// ── the line people read ─────────────────────────────────────────────────────
const line = (p) => paceText(p, formatDuration);
eq(line(thu), "7h 30m to go · 1h 52m a day for the 4 days left", "mid-week: what is left and what each day needs");
eq(line(goalProgress(1200, 15 * 3600, "2026-09-27")), "5h to go — today is the last day",
  "Sunday says it plainly instead of '5h to go · 5h a day for 1 day'");
eq(line(over), "Done — 30m over", "past the goal says by how much");
eq(line(exact), "Done", "exactly met is just done");
eq(line(goalProgress(60, 3630, "2026-09-24")), "Done", "under a minute over is not worth mentioning");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
