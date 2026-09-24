// The daily review's rules. The one most likely to be quietly wrong is the day boundary: an
// answer at 00:30 in Istanbul is 21:30 the previous day in UTC, and a report bucketed by UTC
// would credit the wrong night.
//
// Run: node --experimental-strip-types scripts/test-review.mjs
import {
  coarseWindow, onLocalDate, groupByModule, streakEndingOn, statGains, totalLevel,
  apForDate, tallyVocab,
} from "../lib/review.ts";
import { levelFromXp } from "../lib/leveling.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }

// ── the day boundary ─────────────────────────────────────────────────────────
const D = "2026-09-24";
const at = (iso) => ({ t: new Date(iso) });
const rows = [
  at("2026-09-23T20:59:59Z"), // 23:59:59 on the 23rd in Istanbul — the day before
  at("2026-09-23T21:00:00Z"), // 00:00:00 on the 24th — the first instant of the day
  at("2026-09-24T12:00:00Z"), // midday
  at("2026-09-24T20:59:59Z"), // 23:59:59 on the 24th — the last instant
  at("2026-09-24T21:00:00Z"), // 00:00 on the 25th — the day after, though still the 24th in UTC
];
eq(onLocalDate(rows, D, (r) => r.t).map((r) => r.t.toISOString()),
  ["2026-09-23T21:00:00.000Z", "2026-09-24T12:00:00.000Z", "2026-09-24T20:59:59.000Z"],
  "exactly the instants of the 24th in Istanbul, both edges");
eq(onLocalDate([{ t: null }], D, (r) => r.t), [], "an unanswered row belongs to no day");

const w = coarseWindow(D);
for (const r of rows) {
  ok(r.t >= w.gte && r.t < w.lt, `the coarse window never drops a candidate (${r.t.toISOString()})`);
}

// ── time per module ──────────────────────────────────────────────────────────
const grouped = groupByModule([
  { title: "Physics C", seconds: 1800, stats: ["INTELLIGENCE", "LOGIC"] },
  { title: null, seconds: 600, stats: ["MAGIC", "ESSENCE", "RESONANCE"] },
  { title: "Physics C", seconds: 3600, stats: ["INTELLIGENCE", "LOGIC"] },
  { title: null, seconds: 900, stats: ["MAGIC", "WISDOM", "CHARISMA"] },
  { title: "World History", seconds: 2400, stats: ["WISDOM"] },
]);
eq(grouped.map((g) => [g.title, g.seconds, g.sessions]),
  [["Physics C", 5400, 2], ["World History", 2400, 1], [null, 1500, 2]],
  "same module merges, free study collapses to one row, longest first");
eq(grouped[2].stats, ["MAGIC", "ESSENCE", "RESONANCE", "WISDOM", "CHARISMA"],
  "free study lists every stat it rolled, once each");
eq(grouped[0].stats, ["INTELLIGENCE", "LOGIC"], "a module's stats are not duplicated by merging");
eq(groupByModule([]), [], "no sessions, no rows");

// ── streaks ──────────────────────────────────────────────────────────────────
const days = (...ks) => new Set(ks);
eq(streakEndingOn(D, days("2026-09-22", "2026-09-23", "2026-09-24")), { days: 3, includesToday: true },
  "three days running, today included");
eq(streakEndingOn(D, days("2026-09-22", "2026-09-23")), { days: 2, includesToday: false },
  "nothing yet today: the streak is still counted, but flagged as unfinished");
eq(streakEndingOn(D, days("2026-09-20", "2026-09-24")), { days: 1, includesToday: true },
  "a gap ends the streak");
eq(streakEndingOn(D, days("2026-09-21", "2026-09-22")), { days: 0, includesToday: false },
  "a gap yesterday means no streak at all");
eq(streakEndingOn(D, days()), { days: 0, includesToday: false }, "nothing ever studied");
eq(streakEndingOn("2026-10-01", days("2026-09-29", "2026-09-30", "2026-10-01")), { days: 3, includesToday: true },
  "a streak crosses a month boundary");
eq(streakEndingOn("2026-01-01", days("2025-12-31", "2026-01-01")), { days: 2, includesToday: true },
  "…and a year boundary");

// ── stat gains ───────────────────────────────────────────────────────────────
const before = { INTELLIGENCE: 100, LOGIC: 100, MAGIC: 45 };
const after = { INTELLIGENCE: 190, LOGIC: 190, MAGIC: 45, WISDOM: 30 };
const gains = statGains(before, after);
eq(gains.map((g) => [g.stat, g.xp]), [["INTELLIGENCE", 90], ["LOGIC", 90], ["WISDOM", 30]],
  "only stats that moved, biggest first, ties alphabetical");
eq(gains[0].levelBefore, levelFromXp(100), "level before is the curve at the old XP");
eq(gains[0].levelAfter, levelFromXp(190), "level after is the curve at the new XP");
ok(gains.every((g) => g.levelAfter >= g.levelBefore), "a level never goes down on a gain");
eq(gains.find((g) => g.stat === "WISDOM").levelBefore, 0, "a stat first trained today starts from level 0");
eq(statGains(after, after), [], "an idle day moves nothing");
eq(totalLevel(after), [190, 190, 45, 30].reduce((n, x) => n + levelFromXp(x), 0), "total level sums every stat");
eq(totalLevel({}), 0, "no XP, level 0");

// ── AP units ─────────────────────────────────────────────────────────────────
const units = [
  { course: "Stats", number: 1, title: "Exploring One-Variable Data", completedAt: new Date("2026-09-20T10:00:00Z") },
  { course: "Stats", number: 2, title: "Two-Variable Data", completedAt: new Date("2026-09-23T21:30:00Z") }, // 00:30 on the 24th
  { course: "Stats", number: 3, title: "Collecting Data", completedAt: new Date("2026-09-25T10:00:00Z") },   // a later day
  { course: "Stats", number: 4, title: "Probability", completedAt: null },
  { course: "Macro", number: 1, title: "Basic Economic Concepts", completedAt: new Date("2026-09-24T18:00:00Z") },
];
const ap = apForDate(units, D);
eq(ap.completed.map((u) => `${u.course} ${u.number}`), ["Stats 2", "Macro 1"],
  "ticked on the 24th in Istanbul — including 00:30, which is still the 23rd in UTC");
eq(ap.progress, [{ course: "Stats", done: 2, total: 4 }, { course: "Macro", done: 1, total: 1 }],
  "progress as of the end of that day — a later tick does not count yet");

// ── vocabulary ───────────────────────────────────────────────────────────────
const q = (chosen, answer, verdict, word = "w") => ({ chosenId: chosen, meaningId: answer, verdict, word, meaning: `${word}-m` });
const v = tallyVocab([
  q("a", "a", "DONE", "abate"),
  q("b", "b", "AMBIGUOUS", "abase"),
  q("x", "c", "TO_REVIEW", "cogent"),
  q("d", "d", null, "dearth"),      // right, not filed yet
  q("y", "e", "TO_REVIEW", "efface"),
  q(null, "f", null, "feral"),       // never answered
]);
eq([v.answered, v.correct, v.wrong], [5, 3, 2], "answered counts chosen options only");
eq([v.done, v.ambiguous, v.toReview, v.unfiled], [1, 1, 2, 1], "every verdict, plus correct-but-unfiled");
eq(v.accuracy, 60, "accuracy is correct over answered, rounded");
eq(v.toReviewWords.map((x) => x.word), ["cogent", "efface"], "the To Review words, in answer order");
eq(tallyVocab([]).accuracy, null, "nothing answered is no accuracy, not 0%");
eq(tallyVocab([q("a", "a", "DONE")]).accuracy, 100, "all right is 100%");

if (failures.length) {
  console.error(`${pass} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);
