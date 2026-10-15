// Flashcards for the SAT vocabulary, scheduled the way Anki's classic (SM-2) scheduler does it.
//
// A new card goes through short learning steps (1 minute, then 10), graduates to a review a day
// later, and from then on its interval grows by its "ease" every time you know it. Forgetting a
// review drops its ease and sends it through a short relearning step before it starts over at a
// day. Days start at 4am, as in Anki, so a late night still counts as the same day.
//
// Pure and dependency-free, so the tests can walk a card through its whole life with a fake
// clock. The database side is lib/flashcard-service.ts.

import { APP_TIME_ZONE } from "@/lib/dates";

export type CardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";

/** 1 Again, 2 Hard, 3 Good, 4 Easy — Anki's four buttons. */
export type Rating = 1 | 2 | 3 | 4;
export const RATINGS: readonly Rating[] = [1, 2, 3, 4];
export const RATING_LABELS: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

/** The scheduling side of a card — what an answer changes. */
export interface CardSchedule {
  state: CardState;
  step: number;
  /** Days, once graduated. */
  interval: number;
  ease: number;
  due: Date;
  reps: number;
  lapses: number;
}

/** Anki's defaults. */
export const SETTINGS = {
  /** Minutes. */
  learningSteps: [1, 10],
  relearningSteps: [10],
  /** Days. */
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  maxInterval: 36500,
  /** Hours after midnight at which a new study day starts. */
  dayStartHour: 4,
  /** With nothing else to do, a learning card due within this many minutes is shown early. */
  learnAheadMinutes: 20,
} as const;

const MINUTE = 60_000;

// ─── Study days ──────────────────────────────────────────────────────────────

/** Minutes the app's time zone is ahead of UTC at this moment. */
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  return Math.round((local - Math.floor(at.getTime() / MINUTE) * MINUTE) / MINUTE);
}

/**
 * The study day a moment belongs to, "2026-10-15" — the local date, but one that starts at 4am, so
 * 1am still belongs to the day before.
 */
export function studyDay(at: Date): string {
  const shifted = new Date(at.getTime() - SETTINGS.dayStartHour * 60 * MINUTE);
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(shifted);
}

/** The moment a study day begins: 4am local on that date. */
export function studyDayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, SETTINGS.dayStartHour));
  return new Date(guess.getTime() - zoneOffsetMinutes(guess) * MINUTE);
}

/** The study day `days` after this one. */
export function addStudyDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole study days from one to the other. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * MINUTE));
}

// ─── Answering ───────────────────────────────────────────────────────────────

/** A card that has never been studied. */
export function newSchedule(now: Date): CardSchedule {
  return { state: "NEW", step: 0, interval: 0, ease: SETTINGS.startingEase, due: now, reps: 0, lapses: 0 };
}

/** Delay of a learning step on Hard: halfway to the next step on the first, else the step again. */
function hardDelay(steps: readonly number[], step: number): number {
  if (step === 0) return steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5;
  return steps[Math.min(step, steps.length - 1)];
}

function clampInterval(days: number): number {
  return Math.min(SETTINGS.maxInterval, Math.max(1, Math.round(days)));
}

/** Due at the start of the study day `interval` days from now. */
function dueInDays(now: Date, interval: number): Date {
  return studyDayStart(addStudyDays(studyDay(now), interval));
}

/** The three review intervals — Hard, Good, Easy — each at least a day past the one before. */
function reviewIntervals(card: CardSchedule, now: Date): { hard: number; good: number; easy: number } {
  const late = Math.max(0, daysBetween(studyDay(card.due), studyDay(now)));
  const hard = clampInterval(Math.max(card.interval + 1, card.interval * SETTINGS.hardMultiplier));
  const good = clampInterval(Math.max(hard + 1, (card.interval + late / 2) * card.ease));
  const easy = clampInterval(Math.max(good + 1, (card.interval + late) * card.ease * SETTINGS.easyBonus));
  return { hard, good, easy };
}

/** What answering `rating` does to a card, now. Never changes the card passed in. */
export function answer(card: CardSchedule, rating: Rating, now: Date): CardSchedule {
  const reps = card.reps + 1;

  if (card.state === "NEW" || card.state === "LEARNING" || card.state === "RELEARNING") {
    const relearning = card.state === "RELEARNING";
    const steps = relearning ? SETTINGS.relearningSteps : SETTINGS.learningSteps;
    const learning = relearning ? "RELEARNING" : "LEARNING";
    // A relearned card returns at the interval its lapse left it with; a new one graduates.
    const graduate = (interval: number): CardSchedule => ({
      ...card, state: "REVIEW", step: 0, interval, due: dueInDays(now, interval), reps,
    });

    if (rating === 1) return { ...card, state: learning, step: 0, due: new Date(now.getTime() + steps[0] * MINUTE), reps };
    if (rating === 2) {
      return { ...card, state: learning, due: new Date(now.getTime() + hardDelay(steps, card.step) * MINUTE), reps };
    }
    if (rating === 3) {
      const next = card.step + 1;
      if (next >= steps.length) return graduate(relearning ? Math.max(1, card.interval) : SETTINGS.graduatingInterval);
      return { ...card, state: learning, step: next, due: new Date(now.getTime() + steps[next] * MINUTE), reps };
    }
    return graduate(relearning ? Math.max(1, card.interval) + 1 : SETTINGS.easyInterval);
  }

  // A review.
  if (rating === 1) {
    return {
      ...card,
      state: "RELEARNING",
      step: 0,
      // Anki's default "new interval" after a lapse is 0% of the old one: a day.
      interval: 1,
      ease: Math.max(SETTINGS.minEase, card.ease - 0.2),
      due: new Date(now.getTime() + SETTINGS.relearningSteps[0] * MINUTE),
      reps,
      lapses: card.lapses + 1,
    };
  }
  const next = reviewIntervals(card, now);
  if (rating === 2) {
    return { ...card, interval: next.hard, ease: Math.max(SETTINGS.minEase, card.ease - 0.15), due: dueInDays(now, next.hard), reps };
  }
  if (rating === 3) return { ...card, interval: next.good, due: dueInDays(now, next.good), reps };
  return { ...card, interval: next.easy, ease: card.ease + 0.15, due: dueInDays(now, next.easy), reps };
}

/**
 * What each button would show, as Anki does above them: "1m", "6m", "10m", "1d", "3.2mo".
 * A review's label is its interval in days; a learning step's, the wait.
 */
export function intervalLabels(card: CardSchedule, now: Date): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const rating of RATINGS) {
    const next = answer(card, rating, now);
    out[rating] = next.state === "REVIEW" ? formatDays(next.interval) : formatMinutes((next.due.getTime() - now.getTime()) / MINUTE);
  }
  return out;
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${Math.round(minutes / 60)}h`;
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function formatDays(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${trim(days / 30)}mo`;
  return `${trim(days / 365)}y`;
}

// ─── What to study next ──────────────────────────────────────────────────────

export interface QueueCard {
  id: string;
  state: CardState;
  due: Date;
  newOrder: number;
}

export interface DayCounts {
  /** New cards introduced so far today. */
  newToday: number;
  /** Review cards answered so far today. */
  reviewsToday: number;
}

export interface Limits {
  newPerDay: number;
  reviewsPerDay: number;
}

export interface QueueSummary {
  /** New cards still to introduce today. */
  new: number;
  /** Learning and relearning cards due today. */
  learning: number;
  /** Reviews due today, within the day's limit. */
  review: number;
}

const isLearning = (c: QueueCard) => c.state === "LEARNING" || c.state === "RELEARNING";

/** Anki's three numbers on a deck: new, learning, to review — for today. */
export function summarise(cards: readonly QueueCard[], counts: DayCounts, limits: Limits, now: Date): QueueSummary {
  const dayEnd = studyDayStart(addStudyDays(studyDay(now), 1));
  const newLeft = Math.max(0, limits.newPerDay - counts.newToday);
  const reviewLeft = Math.max(0, limits.reviewsPerDay - counts.reviewsToday);
  return {
    new: Math.min(newLeft, cards.filter((c) => c.state === "NEW").length),
    learning: cards.filter((c) => isLearning(c) && c.due < dayEnd).length,
    review: Math.min(reviewLeft, cards.filter((c) => c.state === "REVIEW" && c.due < dayEnd).length),
  };
}

/**
 * The card to show now, or null when the day is done. In Anki's order: learning cards that are
 * due, then today's reviews, then new cards — and with nothing else left, a learning card due in
 * the next 20 minutes rather than nothing. `waitUntil` says when the next learning card comes due
 * when there is none to show yet.
 */
export function nextCard(
  cards: readonly QueueCard[],
  counts: DayCounts,
  limits: Limits,
  now: Date,
): { id: string | null; waitUntil: Date | null } {
  const byDue = (a: QueueCard, b: QueueCard) => a.due.getTime() - b.due.getTime();
  const learning = cards.filter(isLearning).sort(byDue);

  const dueLearning = learning.find((c) => c.due <= now);
  if (dueLearning) return { id: dueLearning.id, waitUntil: null };

  if (counts.reviewsToday < limits.reviewsPerDay) {
    const review = cards.filter((c) => c.state === "REVIEW" && c.due <= now).sort(byDue)[0];
    if (review) return { id: review.id, waitUntil: null };
  }

  if (counts.newToday < limits.newPerDay) {
    const fresh = cards.filter((c) => c.state === "NEW").sort((a, b) => a.newOrder - b.newOrder)[0];
    if (fresh) return { id: fresh.id, waitUntil: null };
  }

  const soon = learning[0];
  if (soon && soon.due.getTime() - now.getTime() <= SETTINGS.learnAheadMinutes * MINUTE) return { id: soon.id, waitUntil: null };
  const dayEnd = studyDayStart(addStudyDays(studyDay(now), 1));
  return { id: null, waitUntil: soon && soon.due < dayEnd ? soon.due : null };
}
