// The GPA sheet. The fixture is the 11th-grade spreadsheet: each lesson's average, its weighted
// score, and the half's average. One cell of that sheet multiplies the row above it (IELTS),
// so the sheet's displayed 97.05 is not the rule — 97.2 is.
//
// Run: node --experimental-strip-types --import ./scripts/alias.mjs scripts/test-gpa.mjs
import {
  blankMarks,
  blankMarkText,
  formatMark,
  halfScore,
  lessonBodyFromTexts,
  lessonScore,
  parseHoursText,
  parseHoursValue,
  parseMarkText,
  parseMarkValue,
  scoreInput,
  yearScore,
} from "../lib/gpa.ts";
import { readLessonBody } from "../lib/gpa-schema.ts";

let pass = 0;
const failures = [];
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else failures.push(`${label}\n    expected ${e}\n    got      ${a}`);
}
function ok(cond, label) { if (cond) pass++; else failures.push(label); }
function near(actual, expected, label) {
  ok(typeof actual === "number" && Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`);
}

function lesson(hours, first, second = [null, null, null, null, null]) {
  const marks = blankMarks();
  const [h1Exam1, h1Perf1, h1Exam2, h1Perf2, h1Project] = first;
  const [h2Exam1, h2Perf1, h2Exam2, h2Perf2, h2Project] = second;
  Object.assign(marks, {
    h1Exam1, h1Perf1, h1Exam2, h1Perf2, h1Project,
    h2Exam1, h2Perf1, h2Exam2, h2Perf2, h2Project,
  });
  return { hours, marks };
}

// ── the spreadsheet, as one half ─────────────────────────────────────────────
// [name, hours, exam, performance, exam, performance, project]
const SHEET = [
  ["Calculus BC", 4, 95, 95, 95, 100, 100],
  ["Physics C Mech", 4, 95, 95, 95, 100, null],
  ["Physics C E&M", 4, 90, 95, 90, 100, null],
  ["World History", 4, 95, 90, 95, 100, 100],
  ["CS A", 4, 100, 87, 100, 95, null],
  ["Turkish Lit", 4, 95, 95, 95, 95, 100],
  ["IELTS", 4, 95, 100, 95, 100, null],
  ["Tarih", 1, 100, 100, 100, 100, null],
  ["Felsefe", 1, 100, 100, 100, 100, null],
  ["Din Kulturu", 1, 100, 100, 100, 100, null],
  ["Filler", 2, 100, 100, 100, 100, null],
  ["Filler 2", 2, 100, 100, 100, 100, null],
  ["Filler 3", 2, 100, 100, 100, 100, null],
  ["Filller 4", 2, 100, 100, 100, 100, null],
  ["Filler 5", 1, 100, 100, 100, 100, null],
];
const EXPECTED = [
  [97, 388], [96.25, 385], [93.75, 375], [96, 384], [95.5, 382], [96, 384], [97.5, 390],
  [100, 100], [100, 100], [100, 100], [100, 200], [100, 200], [100, 200], [100, 200], [100, 100],
];

const sheetLessons = SHEET.map(([, hours, ...marks]) => lesson(hours, marks));
sheetLessons.forEach((row, i) => {
  const score = lessonScore(row);
  near(score.first, EXPECTED[i][0], `${SHEET[i][0]} average`);
  near(score.firstWeighted, EXPECTED[i][1], `${SHEET[i][0]} weighted`);
  eq(score.second, null, `${SHEET[i][0]} has no second half`);
  near(score.average, EXPECTED[i][0], `${SHEET[i][0]} stands as its own average`);
});

const sheetHalf = halfScore(sheetLessons, "first");
near(sheetHalf.weighted, 3888, "weighted points add to 3888, not the sheet's 3882");
near(sheetHalf.hours, 40, "40 hours");
near(sheetHalf.average, 3888 / 40, "the half is 97.2");
eq(formatMark(sheetHalf.average), "97.2", "shown as 97.2");
eq(formatMark(97.05), "97.05", "the sheet's cached 97.05 is a different number");
eq(halfScore(sheetLessons, "second").average, null, "an empty half has no average");
near(yearScore(sheetHalf.average, null), 3888 / 40, "one half stands as the year");

// A blank project is skipped. Counting it as zero would pull Physics C Mech down to 77.
near(lessonScore(lesson(4, [95, 95, 95, 100, null])).first, 96.25, "blank project is skipped");
near(lessonScore(lesson(4, [0, 100, null, null, null])).first, 50, "a zero counts");
eq(lessonScore(lesson(4, [null, null, null, null, null])).first, null, "no marks, no average");
near(lessonScore(lesson(4, [80, null, null, null, null])).first, 80, "one mark is the average");

// ── weighting, and the two halves ────────────────────────────────────────────
// 4 hours at 90 and 1 hour at 100 is 92, not the plain mean 95.
const weighted = [lesson(4, [90, null, null, null, null]), lesson(1, [100, null, null, null, null])];
near(halfScore(weighted, "first").average, 92, "hours weight the half");

// The year is the average of the two half averages, even when the halves count different hours.
const uneven = [
  lesson(10, [90, null, null, null, null]),
  lesson(2, [null, null, null, null, null], [100, null, null, null, null]),
];
near(halfScore(uneven, "first").average, 90, "first half is the 10-hour lesson");
near(halfScore(uneven, "second").average, 100, "second half is the 2-hour lesson");
near(yearScore(90, 100), 95, "the year averages the halves, it does not weight them by hours again");

// When every lesson has both halves, that year equals the hours-weighted mean of the lesson averages.
const both = [
  lesson(4, [90, null, null, null, null], [80, null, null, null, null]),
  lesson(2, [70, null, null, null, null], [100, null, null, null, null]),
];
const bothYear = yearScore(halfScore(both, "first").average, halfScore(both, "second").average);
near(lessonScore(both[0]).average, 85, "a lesson averages its two halves");
near(lessonScore(both[1]).average, 85, "the other lesson too");
near(bothYear, 85, "both halves filled: the year matches the weighted lesson averages");

// A lesson missing a half still shows that half as its average, but the year follows the halves.
const missing = [
  lesson(4, [90, null, null, null, null], [80, null, null, null, null]),
  lesson(2, [70, null, null, null, null]),
];
near(lessonScore(missing[1]).average, 70, "one half is the lesson's average");
const missingYear = yearScore(halfScore(missing, "first").average, halfScore(missing, "second").average);
near(halfScore(missing, "second").hours, 4, "the lesson with no second-half mark drops out of that half");
ok(Math.abs(missingYear - 80) > 1, "the year is not the weighted mean of the lesson averages");
near(missingYear, (500 / 6 + 80) / 2, "it is the average of the two half averages");

// More marks in one half do not make that half count for more of the lesson.
const crowded = lesson(4, [100, 100, null, null, null], [80, 80, 80, 80, 80]);
near(lessonScore(crowded).average, 90, "two marks and five marks still average as two halves");
ok(Math.abs(lessonScore(crowded).average - (200 + 400) / 7) > 1, "not a flat average of every mark");

// ── what the boxes mean ──────────────────────────────────────────────────────
eq(parseMarkText(""), { state: "empty" }, "blank");
eq(parseMarkText("  "), { state: "empty" }, "whitespace is blank");
eq(parseMarkText("0"), { state: "ok", value: 0 }, "zero is a mark");
eq(parseMarkText("100"), { state: "ok", value: 100 }, "100 is a mark");
eq(parseMarkText("96,5"), { state: "ok", value: 96.5 }, "a comma is the decimal point");
eq(parseMarkText("95."), { state: "partial" }, "a trailing point is still being typed");
eq(parseMarkText("150"), { state: "bad" }, "over 100");
eq(parseMarkText("-1"), { state: "bad" }, "negative");
eq(parseMarkText("abc"), { state: "bad" }, "not a number");
eq(parseMarkText("100.005"), { state: "bad" }, "three decimals");
eq(parseHoursText("0"), { state: "bad" }, "zero hours is not a lesson");
eq(parseHoursText("4"), { state: "ok", value: 4 }, "4 hours");
eq(parseHoursText("4,5"), { state: "ok", value: 4.5 }, "half hours");
eq(parseHoursText("20"), { state: "ok", value: 20 }, "the cap");
eq(parseHoursText("21"), { state: "bad" }, "over the cap");
eq(parseMarkValue(null), null, "API blank");
eq(parseMarkValue(87.5), 87.5, "API mark");
eq(parseMarkValue("95"), undefined, "a string is not a mark");
eq(parseMarkValue(100.1), undefined, "API over 100");
eq(parseMarkValue(-0.01), undefined, "API negative");
eq(parseHoursValue(0), undefined, "API zero hours");
eq(parseHoursValue(4.555), undefined, "API three decimals");
eq(parseHoursValue(4), 4, "API hours");

eq(formatMark(100), "100", "100 shows no decimals");
eq(formatMark(96.25), "96.25", "96.25 stays");
eq(formatMark(95.5), "95.5", "a trailing zero is dropped");

const typed = scoreInput("4.", { ...blankMarkText(), h1Exam1: "95.", h1Perf1: "150", h1Exam2: "" });
near(typed.hours, 4, "a trailing point still counts the hours");
near(typed.marks.h1Exam1, 95, "and the mark");
eq(typed.marks.h1Perf1, null, "a bad mark is skipped on screen");
eq(typed.marks.h1Exam2, null, "an empty mark is skipped");

const saved = { name: "Calculus BC", hours: 4, ...blankMarks(), h1Exam1: 90 };
const kept = lessonBodyFromTexts("Calculus BC", "4", { ...blankMarkText(), h1Exam1: "150" }, saved);
eq(kept.h1Exam1, 90, "a mark that isn't one keeps the saved mark");
const cleared = lessonBodyFromTexts("  IELTS  ", "4", blankMarkText(), saved);
eq([cleared.name, cleared.h1Exam1], ["IELTS", null], "trims the name, and a blank clears the mark");
eq(lessonBodyFromTexts("  ", "", blankMarkText(), null), null, "nothing to save yet");

// ── the body the routes accept ───────────────────────────────────────────────
const good = readLessonBody({ name: "  Tarih ", hours: 1, ...blankMarks(), h1Exam1: 100, h2Project: null });
eq(good.ok && good.body.name, "Tarih", "trims the name");
eq(good.ok && good.body.hours, 1, "keeps the hours");
eq(good.ok && good.body.h1Exam1, 100, "keeps the mark");
eq(readLessonBody({ name: "Tarih", hours: 0, ...blankMarks() }).error, "Weekly hours, up to 20.", "refuses 0 hours");
eq(readLessonBody({ name: "Tarih", hours: 4, ...blankMarks(), h1Exam1: 100.5 }).error, "Use 0 to 100, with at most two decimals.", "refuses 100.5");
eq(readLessonBody({ name: " ", hours: 4, ...blankMarks() }).error, "Name the lesson.", "refuses a blank name");
eq(readLessonBody({ name: "Tarih", hours: "4", ...blankMarks() }).ok, false, "hours arrive as a number");
eq(readLessonBody({ name: "x".repeat(81), hours: 4, ...blankMarks() }).ok, false, "80 characters is the name");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`gpa: ${pass} passed`);
