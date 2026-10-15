// Database side of the flashcards. The scheduling rules are in lib/flashcards.ts.

import type { Prisma, VocabCardState } from "@prisma/client";
import { db } from "@/lib/db";
import { shuffle } from "@/lib/vocab";
import {
  answer, intervalLabels, nextCard, studyDay, studyDayStart, summarise,
  type CardSchedule, type Limits, type QueueSummary, type Rating,
} from "@/lib/flashcards";

export class FlashcardError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Makes a card for every word that has none yet — on first use, and after words are imported.
 * New cards come in a random order, fixed now, after any already waiting.
 */
export async function ensureCards(): Promise<void> {
  const missing = await db.vocabWord.findMany({ where: { card: null }, select: { id: true } });
  if (missing.length === 0) return;
  const last = await db.vocabCard.aggregate({ _max: { newOrder: true } });
  const start = (last._max.newOrder ?? 0) + 1;
  await db.vocabCard.createMany({
    data: shuffle(missing).map((w, i) => ({ wordId: w.id, newOrder: start + i })),
    skipDuplicates: true,
  });
}

export async function flashLimits(): Promise<Limits> {
  const config = await db.studyConfig.findUnique({ where: { id: "global" } });
  return { newPerDay: config?.flashNewPerDay ?? 20, reviewsPerDay: config?.flashReviewsPerDay ?? 200 };
}

export async function setFlashLimits(limits: Limits): Promise<void> {
  const data = { flashNewPerDay: limits.newPerDay, flashReviewsPerDay: limits.reviewsPerDay };
  await db.studyConfig.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
}

/** Today's answers so far: new cards introduced and reviews done — what the limits count. */
async function dayCounts(now: Date) {
  const since = studyDayStart(studyDay(now));
  const rows = await db.vocabReview.groupBy({
    by: ["stateBefore"],
    where: { reviewedAt: { gte: since } },
    _count: { _all: true },
  });
  const count = (s: VocabCardState) => rows.find((r) => r.stateBefore === s)?._count._all ?? 0;
  return { newToday: count("NEW"), reviewsToday: count("REVIEW"), answeredToday: rows.reduce((n, r) => n + r._count._all, 0) };
}

export interface CardView {
  id: string;
  word: string;
  meanings: string[];
  state: VocabCardState;
  /** Answering this card should find it at this many reps — guards against a double answer. */
  reps: number;
  labels: Record<Rating, string>;
}

export interface DeckView {
  summary: QueueSummary;
  total: number;
  card: CardView | null;
  /** When nothing is due yet but a learning card comes due later today. */
  waitUntil: string | null;
  answeredToday: number;
  canUndo: boolean;
  limits: Limits;
}

const SCHEDULE_FIELDS = { state: true, step: true, interval: true, ease: true, due: true, reps: true, lapses: true } as const;

/** Everything the flashcards page shows: today's numbers and the card to study now. */
export async function deck(now: Date = new Date()): Promise<DeckView> {
  await ensureCards();
  const [cards, counts, limits, lastToday] = await Promise.all([
    db.vocabCard.findMany({ select: { id: true, state: true, due: true, newOrder: true } }),
    dayCounts(now),
    flashLimits(),
    db.vocabReview.findFirst({ where: { reviewedAt: { gte: studyDayStart(studyDay(now)) } }, select: { id: true } }),
  ]);

  const { id, waitUntil } = nextCard(cards, counts, limits, now);
  let card: CardView | null = null;
  if (id) {
    const row = await db.vocabCard.findUniqueOrThrow({
      where: { id },
      select: { ...SCHEDULE_FIELDS, id: true, word: { select: { word: true, meanings: { orderBy: { position: "asc" }, select: { text: true } } } } },
    });
    card = {
      id: row.id,
      word: row.word.word,
      meanings: row.word.meanings.map((m) => m.text),
      state: row.state,
      reps: row.reps,
      labels: intervalLabels(row, now),
    };
  }

  return {
    summary: summarise(cards, counts, limits, now),
    total: cards.length,
    card,
    waitUntil: waitUntil?.toISOString() ?? null,
    answeredToday: counts.answeredToday,
    canUndo: lastToday !== null,
    limits,
  };
}

/**
 * Answers a card. `reps` is what the card showed when it was answered: a second tap on the same
 * card (or the same card answered in another tab) finds it moved on and is refused, so one look
 * never counts twice.
 */
export async function answerCard(cardId: string, rating: Rating, reps: number, now: Date = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const card = await tx.vocabCard.findUnique({ where: { id: cardId }, select: SCHEDULE_FIELDS });
    if (!card) throw new FlashcardError("That card is gone — its word was deleted.", 404);
    if (card.reps !== reps) throw new FlashcardError("That card was already answered.", 409);

    const next: CardSchedule = answer(card, rating, now);
    const moved = await tx.vocabCard.updateMany({
      where: { id: cardId, reps },
      data: { ...next, lastReviewedAt: now },
    });
    if (moved.count === 0) throw new FlashcardError("That card was already answered.", 409);
    await tx.vocabReview.create({
      data: {
        cardId,
        rating,
        stateBefore: card.state,
        before: { ...card, due: card.due.toISOString() } as Prisma.InputJsonObject,
        reviewedAt: now,
      },
    });
  });
}

/** Takes back today's last answer, as Anki's Undo does: the card returns to how it was. */
export async function undoLast(now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const last = await tx.vocabReview.findFirst({
      where: { reviewedAt: { gte: studyDayStart(studyDay(now)) } },
      orderBy: { reviewedAt: "desc" },
    });
    if (!last) return false;
    const before = last.before as Record<string, unknown>;
    await tx.vocabCard.update({
      where: { id: last.cardId },
      data: {
        state: before.state as VocabCardState,
        step: Number(before.step),
        interval: Number(before.interval),
        ease: Number(before.ease),
        due: new Date(String(before.due)),
        reps: Number(before.reps),
        lapses: Number(before.lapses),
      },
    });
    await tx.vocabReview.delete({ where: { id: last.id } });
    return true;
  });
}
