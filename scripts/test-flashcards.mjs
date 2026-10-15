// Flashcards, scheduled like Anki. What decides whether it can be trusted: a card walks through
// learning, graduation, growing reviews, a lapse and relearning exactly as Anki's defaults would;
// study days turn over at 4am Istanbul time, not midnight; the buttons show the intervals that
// answering would really give; and the queue serves learning, reviews and new cards in Anki's
// order within the daily limits.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-flashcards.mjs
import {
  answer, newSchedule, intervalLabels, formatDays, studyDay, studyDayStart, addStudyDays, summarise, nextCard, SETTINGS,
} from "../lib/flashcards.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
const at = (iso) => new Date(iso);
const mins = (from, to) => Math.round((to.getTime() - from.getTime()) / 60000);

// ── study days (Istanbul is UTC+3; a day starts at 4am local = 01:00 UTC) ────
eq(studyDay(at("2026-10-15T09:00:00Z")), "2026-10-15", "midday is that day");
eq(studyDay(at("2026-10-15T00:30:00Z")), "2026-10-14", "3:30am local still belongs to the day before");
eq(studyDay(at("2026-10-15T01:00:00Z")), "2026-10-15", "4am local starts the day");
eq(studyDayStart("2026-10-15").toISOString(), "2026-10-15T01:00:00.000Z", "a day starts at 4am local");
eq([addStudyDays("2026-10-31", 1), addStudyDays("2026-12-31", 1), addStudyDays("2026-03-01", -1)],
  ["2026-11-01", "2027-01-01", "2026-02-28"], "adding days across months and years");

// ── a new card learning ──────────────────────────────────────────────────────
const t0 = at("2026-10-15T09:00:00Z");
const fresh = newSchedule(t0);
eq(intervalLabels(fresh, t0), { 1: "1m", 2: "6m", 3: "10m", 4: "4d" }, "a new card's buttons, as Anki shows them");

const again = answer(fresh, 1, t0);
eq([again.state, again.step, mins(t0, again.due)], ["LEARNING", 0, 1], "Again: back to the first step, in a minute");
const good1 = answer(fresh, 3, t0);
eq([good1.state, good1.step, mins(t0, good1.due)], ["LEARNING", 1, 10], "Good: the next step, in ten minutes");
const hard1 = answer(good1, 2, t0);
eq([hard1.step, mins(t0, hard1.due)], [1, 10], "Hard on a later step: that step again");
const t1 = at("2026-10-15T09:10:00Z");
const grad = answer(good1, 3, t1);
eq([grad.state, grad.interval, grad.due.toISOString(), grad.ease], ["REVIEW", 1, "2026-10-16T01:00:00.000Z", 2.5],
  "Good on the last step graduates: due tomorrow at 4am");
const easyNew = answer(fresh, 4, t0);
eq([easyNew.state, easyNew.interval, easyNew.due.toISOString()], ["REVIEW", 4, "2026-10-19T01:00:00.000Z"], "Easy on a new card: four days");
eq([fresh.state, fresh.reps], ["NEW", 0], "answering never changes the card it was given");

// ── reviews ──────────────────────────────────────────────────────────────────
const t2 = at("2026-10-16T08:00:00Z");
eq(intervalLabels(grad, t2), { 1: "10m", 2: "2d", 3: "3d", 4: "4d" }, "a 1-day review's buttons: each at least a day past the one before");
const r1 = answer(grad, 3, t2);
eq([r1.interval, r1.due.toISOString(), r1.ease], [3, "2026-10-19T01:00:00.000Z", 2.5], "Good: interval grows (at least a day past Hard)");
const t3 = at("2026-10-19T10:00:00Z");
const r2 = answer(r1, 3, t3);
eq([r2.interval, r2.ease], [8, 2.5], "Good again: 3 × 2.5 → 8");
const r2hard = answer(r1, 2, t3);
eq([r2hard.interval, r2hard.ease], [4, 2.35], "Hard: × 1.2 (at least +1), ease −0.15");
const r2easy = answer(r1, 4, t3);
eq([r2easy.interval, r2easy.ease], [10, 2.65], "Easy: × ease × 1.3, ease +0.15");
const late = answer(r1, 3, at("2026-10-23T10:00:00Z"));
eq(late.interval, 13, "reviewed 4 days late: half the lateness counts toward Good ((3+2) × 2.5)");

// ── forgetting ───────────────────────────────────────────────────────────────
const lapse = answer(r2, 1, at("2026-10-27T10:00:00Z"));
eq([lapse.state, lapse.interval, lapse.ease, lapse.lapses, mins(at("2026-10-27T10:00:00Z"), lapse.due)],
  ["RELEARNING", 1, 2.3, 1, 10], "Again on a review: relearn in 10 minutes, ease −0.2, a lapse");
const relearned = answer(lapse, 3, at("2026-10-27T10:10:00Z"));
eq([relearned.state, relearned.interval, relearned.due.toISOString()], ["REVIEW", 1, "2026-10-28T01:00:00.000Z"], "relearned: back to reviews at a day");
let worn = grad;
for (let i = 0; i < 10; i++) worn = answer({ ...worn, state: "REVIEW" }, 1, t2);
eq(worn.ease, SETTINGS.minEase, "ease never drops below 1.3");

// ── labels ───────────────────────────────────────────────────────────────────
eq([formatDays(1), formatDays(29), formatDays(45), formatDays(400)], ["1d", "29d", "1.5mo", "1.1y"], "day labels");

// ── the queue ────────────────────────────────────────────────────────────────
const now = at("2026-10-15T09:00:00Z");
const cards = [
  { id: "new2", state: "NEW", due: now, newOrder: 2 },
  { id: "new1", state: "NEW", due: now, newOrder: 1 },
  { id: "rev", state: "REVIEW", due: at("2026-10-14T01:00:00Z") },
  { id: "learnLater", state: "LEARNING", due: at("2026-10-15T09:05:00Z") },
  { id: "learnNow", state: "RELEARNING", due: at("2026-10-15T08:59:00Z") },
  { id: "revTomorrow", state: "REVIEW", due: at("2026-10-16T01:00:00Z") },
].map((c) => ({ newOrder: 0, ...c }));
const limits = { newPerDay: 20, reviewsPerDay: 200 };
const none = { newToday: 0, reviewsToday: 0 };
eq(summarise(cards, none, limits, now), { new: 2, learning: 2, review: 1 }, "today's numbers: tomorrow's review isn't one");
eq(summarise(cards, { newToday: 19, reviewsToday: 200 }, limits, now), { new: 1, learning: 2, review: 0 }, "limits cap new cards and reviews");
eq(nextCard(cards, none, limits, now).id, "learnNow", "a due learning card first");
const noLearnNow = cards.filter((c) => c.id !== "learnNow");
eq(nextCard(noLearnNow, none, limits, now).id, "rev", "then reviews");
eq(nextCard(noLearnNow.filter((c) => c.id !== "rev"), none, limits, now).id, "new1", "then new cards, in their order");
eq(nextCard(noLearnNow.filter((c) => c.id !== "rev"), { newToday: 20, reviewsToday: 0 }, limits, now).id, "learnLater",
  "new limit reached: a learning card due within 20 minutes is shown early");
const onlyLater = [{ id: "l", state: "LEARNING", due: at("2026-10-15T10:00:00Z"), newOrder: 0 }];
eq(nextCard(onlyLater, none, limits, now), { id: null, waitUntil: at("2026-10-15T10:00:00Z") }, "nothing yet: says when the next one comes due");
eq(nextCard([cards[5]], none, limits, now), { id: null, waitUntil: null }, "done for the day");

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${pass} passed\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ flashcards: ${pass} assertions passed`);
