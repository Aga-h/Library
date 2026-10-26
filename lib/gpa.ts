// The GPA sheet. A lesson has weekly hours and, for each half of the year, up to two exams,
// two performances and a project — the columns of the 11th-grade spreadsheet this follows.
//
// A half's lesson average is the mean of the marks filled in. A blank is skipped, not a zero,
// which is what Excel's AVERAGE does with an empty cell. The half's average weights each lesson
// that has a mark by its hours: sum(average × hours) / sum(hours). The year is the average of
// the two halves, so a half with more marks does not count for more of the year.
//
// One cell of that spreadsheet multiplies the wrong row (IELTS's weighted score uses the row
// above it). The rule here is each lesson's own average times its own hours.

export const MARK_KEYS = [
  "h1Exam1", "h1Perf1", "h1Exam2", "h1Perf2", "h1Project",
  "h2Exam1", "h2Perf1", "h2Exam2", "h2Perf2", "h2Project",
] as const;

export type MarkKey = (typeof MARK_KEYS)[number];

/** The five cells of one half, and the same five of the other, with the label the field shows. */
export const MARK_FIELDS = [
  { h1: "h1Exam1", h2: "h2Exam1", label: "1st exam" },
  { h1: "h1Perf1", h2: "h2Perf1", label: "1st performance" },
  { h1: "h1Exam2", h2: "h2Exam2", label: "2nd exam" },
  { h1: "h1Perf2", h2: "h2Perf2", label: "2nd performance" },
  { h1: "h1Project", h2: "h2Project", label: "Project" },
] as const;

const FIRST_HALF: readonly MarkKey[] = MARK_FIELDS.map((f) => f.h1);
const SECOND_HALF: readonly MarkKey[] = MARK_FIELDS.map((f) => f.h2);

export const MAX_HOURS = 20;
export const NAME_MAX = 80;

export const MARK_ERROR = "Use 0 to 100, with at most two decimals.";
export const HOURS_ERROR = "Weekly hours, up to 20.";
export const NAME_ERROR = "Name the lesson.";
/** The page and the API say this until migration 040 has run. */
export const GPA_NOT_READY = "Saving grades starts once 040-gpa.sql has run in Supabase.";

export type LessonBody = { name: string; hours: number } & Record<MarkKey, number | null>;

export type GpaLesson = LessonBody & { id: string; position: number };

export type GpaLessonInput = { hours: number; marks: Record<MarkKey, number | null> };

export function blankMarks(): Record<MarkKey, number | null> {
  return Object.fromEntries(MARK_KEYS.map((key) => [key, null])) as Record<MarkKey, number | null>;
}

export function blankMarkText(): Record<MarkKey, string> {
  return Object.fromEntries(MARK_KEYS.map((key) => [key, ""])) as Record<MarkKey, string>;
}

/** Up to two decimal places, trailing zeros dropped: 96.25, 97.2, 100. */
export function formatMark(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function marksToText(marks: Record<MarkKey, number | null>): Record<MarkKey, string> {
  const out = blankMarkText();
  for (const key of MARK_KEYS) out[key] = marks[key] === null ? "" : formatMark(marks[key]);
  return out;
}

type FieldState =
  | { state: "empty" }
  | { state: "ok"; value: number }
  | { state: "partial" }
  | { state: "bad" };

function roundHundredth(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "96,5" and "96.5" are the same mark. A comma is the decimal point, once. */
function numericText(raw: string): string {
  return raw.trim().replace(",", ".");
}

/** Digits typed so far, ignoring a trailing decimal point. Null when there aren't any. */
export function numberSoFar(raw: string): number | null {
  const t = numericText(raw).replace(/\.$/, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? roundHundredth(n) : null;
}

function classify(raw: string, accept: (n: number) => boolean, places: RegExp, partial: RegExp): FieldState {
  const t = numericText(raw);
  if (t === "") return { state: "empty" };
  if (places.test(t)) {
    const n = Number(t);
    return accept(n) ? { state: "ok", value: roundHundredth(n) } : { state: "bad" };
  }
  if (partial.test(t)) return { state: "partial" };
  return { state: "bad" };
}

/** A mark box. "95." is still being typed; "150" and "abc" are not marks. */
export function parseMarkText(raw: string): FieldState {
  return classify(
    raw,
    (n) => n >= 0 && n <= 100,
    /^\d{1,3}(\.\d{1,2})?$/,
    /^\d{0,3}\.?$|^\d{1,3}\.\d{0,2}$/,
  );
}

/** Weekly hours of one lesson. Zero is not a lesson, and 20 is the cap that catches a typo. */
export function parseHoursText(raw: string): FieldState {
  return classify(
    raw,
    (n) => n > 0 && n <= MAX_HOURS,
    /^\d{1,2}(\.\d{1,2})?$/,
    /^\d{0,2}\.?$|^\d{1,2}\.\d{0,2}$/,
  );
}

function hundredths(value: number, min: number, max: number, minExclusive: boolean): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return undefined;
  const n = roundHundredth(value);
  if (n > max || (minExclusive ? n <= min : n < min)) return undefined;
  return n;
}

/** A mark from the API: null, or 0–100 to two decimals. Anything else is rejected. */
export function parseMarkValue(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number") return undefined;
  return hundredths(value, 0, 100, false);
}

/** Hours from the API. */
export function parseHoursValue(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  return hundredths(value, 0, MAX_HOURS, true);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function filled(marks: Record<MarkKey, number | null>, keys: readonly MarkKey[]): number[] {
  const out: number[] = [];
  for (const key of keys) {
    const value = marks[key];
    if (value !== null) out.push(value);
  }
  return out;
}

export type LessonScore = {
  first: number | null;
  second: number | null;
  /** The two halves, averaged. A lesson with only one half so far uses that half. */
  average: number | null;
  firstWeighted: number | null;
  secondWeighted: number | null;
};

export function lessonScore(lesson: GpaLessonInput): LessonScore {
  const first = mean(filled(lesson.marks, FIRST_HALF));
  const second = mean(filled(lesson.marks, SECOND_HALF));
  const halves = [first, second].filter((n): n is number => n !== null);
  const hours = lesson.hours;
  const weight = (avg: number | null) => (avg === null || !(hours > 0) ? null : avg * hours);
  return { first, second, average: mean(halves), firstWeighted: weight(first), secondWeighted: weight(second) };
}

export type HalfScore = {
  average: number | null;
  /** Hours of the lessons that have a mark this half. */
  hours: number;
  weighted: number;
};

export function halfScore(lessons: GpaLessonInput[], half: "first" | "second"): HalfScore {
  let hours = 0;
  let weighted = 0;
  for (const lesson of lessons) {
    if (!(lesson.hours > 0) || !Number.isFinite(lesson.hours)) continue;
    const avg = half === "first" ? lessonScore(lesson).first : lessonScore(lesson).second;
    if (avg === null) continue;
    hours += lesson.hours;
    weighted += avg * lesson.hours;
  }
  return { average: hours > 0 ? weighted / hours : null, hours, weighted };
}

/** The year is the average of the halves that have a mark. One half alone stands as the year. */
export function yearScore(first: number | null, second: number | null): number | null {
  return mean([first, second].filter((n): n is number => n !== null));
}

/**
 * What a save would store from the boxes. A box that isn't a mark yet keeps the last stored
 * mark when there is one, so a half-typed "150" does not wipe the 90 already saved. Null when
 * there is no name and no hours to save at all.
 */
export function lessonBodyFromTexts(
  nameText: string,
  hoursText: string,
  markTexts: Record<MarkKey, string>,
  saved: LessonBody | null,
): LessonBody | null {
  const trimmed = nameText.trim();
  const name = trimmed.length > 0 && trimmed.length <= NAME_MAX ? trimmed : saved?.name ?? null;
  if (!name) return null;

  const hoursParsed = parseHoursText(hoursText);
  const hours = hoursParsed.state === "ok" ? hoursParsed.value : saved?.hours ?? null;
  if (hours === null) return null;

  const marks = blankMarks();
  for (const key of MARK_KEYS) {
    const parsed = parseMarkText(markTexts[key]);
    if (parsed.state === "ok") marks[key] = parsed.value;
    else if (parsed.state === "empty") marks[key] = null;
    else if (parsed.state === "partial") {
      const n = numberSoFar(markTexts[key]);
      if (n !== null && n >= 0 && n <= 100) marks[key] = n;
      else if (saved) marks[key] = saved[key];
      else return null;
    } else if (saved) marks[key] = saved[key];
    else return null;
  }
  return { name, hours, ...marks };
}

/** The marks on screen. A box that isn't a mark is skipped, the way a blank is. */
export function scoreInput(hoursText: string, markTexts: Record<MarkKey, string>): GpaLessonInput {
  const hoursParsed = parseHoursText(hoursText);
  let hours = 0;
  if (hoursParsed.state === "ok") hours = hoursParsed.value;
  else {
    const n = numberSoFar(hoursText);
    if (n !== null && n > 0 && n <= MAX_HOURS) hours = n;
  }
  const marks = blankMarks();
  for (const key of MARK_KEYS) {
    const parsed = parseMarkText(markTexts[key]);
    if (parsed.state === "ok") marks[key] = parsed.value;
    else if (parsed.state === "partial") {
      const n = numberSoFar(markTexts[key]);
      if (n !== null && n >= 0 && n <= 100) marks[key] = n;
    }
  }
  return { hours, marks };
}
