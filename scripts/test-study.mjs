// The XP rule and the clock arithmetic behind it. This is the money path: it decides what a
// session pays, so an off-by-one here is silently wrong levels forever.
//
// Run: node --experimental-strip-types scripts/test-study.mjs
import {
  xpForSeconds, secondsBetween, runningSeconds, formatDuration, formatStopwatch,
  MIN_XP_MINUTES, XP_PER_MINUTE, FREE_STUDY_STATS,
} from "../lib/study.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── what a session pays ──────────────────────────────────────────────────────
eq(xpForSeconds(0), 0, "nothing studied pays nothing");
eq(xpForSeconds(1), 0, "a second pays nothing");
eq(xpForSeconds(59), 0, "59 seconds does not round up to a minute");
eq(xpForSeconds(60), 1, "a minute pays one");
eq(xpForSeconds(61), 1, "…and a minute and a second still pays one");
eq(xpForSeconds(119), 1, "part-minutes are dropped, never rounded");
eq(xpForSeconds(120), 2, "two minutes pay two");
eq(xpForSeconds(3600), 60, "an hour pays sixty");
eq(xpForSeconds(-5), 0, "a negative duration pays nothing rather than going negative");
eq(MIN_XP_MINUTES, 1, "the floor is one whole minute");
eq(XP_PER_MINUTE, 1, "one XP per minute");
eq(FREE_STUDY_STATS, 3, "a free session rolls three stats");

// Monotonic: more time studied is never less XP.
let previous = 0;
for (let s = 0; s <= 7200; s += 7) {
  const xp = xpForSeconds(s);
  ok(xp >= previous, `xp never goes down (${s}s)`);
  ok(xp === Math.floor(s / 60), `xp is whole minutes studied (${s}s)`);
  previous = xp;
}

// ── clock arithmetic ─────────────────────────────────────────────────────────
const t0 = new Date("2026-09-24T10:00:00Z");
eq(secondsBetween(t0, new Date("2026-09-24T10:00:30Z")), 30, "half a minute");
eq(secondsBetween(t0, new Date("2026-09-24T11:30:00Z")), 5400, "an hour and a half");
eq(secondsBetween(t0, t0), 0, "no time at all");
// A server clock that steps backwards must not hand out a negative session.
eq(secondsBetween(t0, new Date("2026-09-24T09:59:00Z")), 0, "a backwards clock floors at zero");

const running = { id: "s1", startedAt: t0.toISOString(), stats: [], module: null };
eq(runningSeconds(running, Date.parse("2026-09-24T10:02:00Z")), 120, "two minutes on the clock");
eq(runningSeconds(running, Date.parse("2026-09-24T09:58:00Z")), 0, "…and never negative");

// ── formatting ───────────────────────────────────────────────────────────────
eq(formatDuration(0), "0s", "zero");
eq(formatDuration(45), "45s", "under a minute");
eq(formatDuration(60), "1m", "exactly a minute");
eq(formatDuration(3600), "1h", "a round hour drops the minutes");
eq(formatDuration(9000), "2h 30m", "hours and minutes");
eq(formatDuration(-10), "0s", "negatives floor at zero");

eq(formatStopwatch(0), "00:00", "stopwatch starts at zero");
eq(formatStopwatch(59), "00:59", "under a minute");
eq(formatStopwatch(605), "10:05", "minutes and seconds are padded");
eq(formatStopwatch(3661), "01:01:01", "past an hour it grows a field");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
