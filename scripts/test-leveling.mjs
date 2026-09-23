// The stat curve. It is one formula with one dial, and the whole Tasks section hangs off it,
// so the properties that make it a sane curve are asserted rather than eyeballed.
//
// Run: node --experimental-strip-types scripts/test-leveling.mjs
import {
  CURVE_HEIGHT, XP_SCALE, levelFromXp, xpForLevel, levelProgress, minutesToNextLevel,
} from "../lib/leveling.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }
function near(actual, expected, tol, label) {
  if (Math.abs(actual - expected) <= tol) pass++;
  else failures.push(`${label}\n    expected ${expected} ±${tol}\n    got      ${actual}`);
}

// ── the dial ─────────────────────────────────────────────────────────────────
// The scale is tied to the dial; picking it separately is what would move level 1.
eq(XP_SCALE, 30 * CURVE_HEIGHT, "scale stays tied to k");

// ── the floor ────────────────────────────────────────────────────────────────
eq(levelFromXp(0), 0, "every stat starts at 0");
eq(levelFromXp(-50), 0, "negative xp cannot go below 0");
eq(xpForLevel(0), 0, "level 0 costs nothing");
eq(xpForLevel(-3), 0, "no negative levels");

// ── round-trip: the xp a level costs must land exactly on that level ─────────
for (let level = 0; level <= 60; level++) {
  eq(levelFromXp(xpForLevel(level)), level, `xpForLevel(${level}) lands on ${level}`);
}

// ── and one XP short must not ────────────────────────────────────────────────
for (let level = 1; level <= 60; level++) {
  eq(levelFromXp(xpForLevel(level) - 1), level - 1, `one xp short of ${level} is still ${level - 1}`);
}

// ── monotonic, never jumping a level ─────────────────────────────────────────
let prev = 0;
for (let xp = 0; xp <= 60000; xp += 7) {
  const level = levelFromXp(xp);
  ok(level >= prev, `level never goes down (xp ${xp})`);
  ok(level - prev <= 1, `level never skips (xp ${xp})`);
  prev = level;
}

// ── the shape the dial promises ──────────────────────────────────────────────
// Each level costs e^(1/k) times the last, so a doubling of hours always buys the same
// ln(2)*k levels — at the bottom of the curve and at the top alike.
const perDoubling = Math.LN2 * CURVE_HEIGHT;
for (const hours of [10, 100, 1000, 10000]) {
  const at = levelFromXp(hours * 60);
  const doubled = levelFromXp(hours * 120);
  near(doubled - at, perDoubling, 1, `doubling ${hours}h buys ~${perDoubling.toFixed(1)} levels`);
}

// ── the numbers this k was chosen for (hours to reach a level) ───────────────
const hoursTo = (level) => xpForLevel(level) / 60;
near(hoursTo(1), 0.5, 0.05, "level 1 is about half an hour");
near(hoursTo(10), 8.6, 0.1, "level 10 at ~8.6h");
near(hoursTo(20), 32, 0.5, "level 20 at ~32h");
near(hoursTo(30), 95, 1, "level 30 at ~95h");
near(hoursTo(40), 268, 2, "level 40 at ~268h");
near(hoursTo(50), 737, 3, "level 50 at ~737h");

// ── progress within a level ──────────────────────────────────────────────────
const fresh = levelProgress(xpForLevel(12));
eq(fresh.level, 12, "just levelled: level is 12");
eq(fresh.into, 0, "just levelled: nothing into it yet");
eq(fresh.ratio, 0, "just levelled: bar empty");
eq(fresh.nextAt, xpForLevel(13), "next level is the next threshold");

const mid = levelProgress(Math.round((xpForLevel(12) + xpForLevel(13)) / 2));
eq(mid.level, 12, "halfway: still level 12");
near(mid.ratio, 0.5, 0.01, "halfway: bar is about half");
ok(mid.remaining > 0 && mid.remaining < mid.span, "halfway: some way to go, less than a level");

const zero = levelProgress(0);
eq(zero.level, 0, "zero xp: level 0");
eq(zero.ratio, 0, "zero xp: bar empty");
ok(zero.span > 0, "zero xp: span is never zero, so the bar never divides by zero");

eq(minutesToNextLevel(xpForLevel(5)), xpForLevel(6) - xpForLevel(5), "minutes to next = the gap");

// ── one XP is one minute, so a worked session moves the bar ──────────────────
const beforeSession = levelProgress(500);
const afterSession = levelProgress(500 + 90); // a 90-minute task
eq(afterSession.xp - beforeSession.xp, 90, "90 minutes worked is 90 xp");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
