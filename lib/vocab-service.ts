// Database side of the vocabulary test. Pure rules live in lib/vocab.ts.

import type { VocabVerdict } from "@prisma/client";
import { db } from "@/lib/db";
import { buildQuestions, parseWordList } from "@/lib/vocab";

export interface ImportSummary {
  wordsAdded: number;
  wordsUpdated: number;
  meaningsTotal: number;
  skipped: { line: number; text: string; reason: string }[];
}

/**
 * Replaces a word's meanings with the pasted ones, leaving words not mentioned alone.
 *
 * Re-importing the same list is a no-op rather than a duplicate, so the list can be pasted again
 * with a correction in it.
 */
export async function importWordList(input: string): Promise<ImportSummary> {
  const { words, skipped } = parseWordList(input);
  let added = 0;
  let updated = 0;
  let meaningsTotal = 0;

  for (const entry of words) {
    const existing = await db.vocabWord.findUnique({ where: { word: entry.word } });
    if (existing) {
      // Meanings are positional, so the simplest correct update is to lay them down again.
      await db.vocabMeaning.deleteMany({ where: { wordId: existing.id } });
      await db.vocabMeaning.createMany({
        data: entry.meanings.map((text, i) => ({ wordId: existing.id, text, position: i + 1 })),
      });
      updated++;
    } else {
      await db.vocabWord.create({
        data: {
          word: entry.word,
          meanings: { create: entry.meanings.map((text, i) => ({ text, position: i + 1 })) },
        },
      });
      added++;
    }
    meaningsTotal += entry.meanings.length;
  }

  return { wordsAdded: added, wordsUpdated: updated, meaningsTotal, skipped };
}

/** The run in progress, with everything the page needs to render it. */
export async function currentRun() {
  return db.vocabRun.findFirst({
    orderBy: { startedAt: "desc" },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: { meaning: { include: { word: true } } },
      },
    },
  });
}

/**
 * Starts a fresh run: one question per meaning, shuffled, distractors drawn from other words.
 *
 * This is what "take the test again" does, and it is what resets the three categories — they are
 * the verdicts on the current run's questions, so a new run starts them empty.
 */
export async function startRun() {
  const meanings = await db.vocabMeaning.findMany({ select: { id: true, wordId: true } });
  if (meanings.length === 0) return null;

  const built = buildQuestions(meanings);
  const run = await db.vocabRun.create({ data: {} });
  await db.vocabQuestion.createMany({
    data: built.map((q) => ({
      runId: run.id,
      meaningId: q.meaningId,
      position: q.position,
      optionIds: q.optionIds,
    })),
  });
  return run;
}

export interface AnswerOutcome {
  correct: boolean;
  correctMeaningId: string;
  verdict: VocabVerdict | null;
}

/**
 * Records the chosen option. A wrong answer goes straight to To Review with no say in the
 * matter; a right one waits for you to call it Done or Ambiguous.
 */
export async function answerQuestion(questionId: string, chosenId: string): Promise<AnswerOutcome | null> {
  const question = await db.vocabQuestion.findUnique({ where: { id: questionId } });
  if (!question) return null;
  if (!question.optionIds.includes(chosenId)) return null;

  const correct = chosenId === question.meaningId;
  const verdict: VocabVerdict | null = correct ? null : "TO_REVIEW";

  await db.vocabQuestion.update({
    where: { id: questionId },
    data: { chosenId, verdict, answeredAt: new Date() },
  });

  return { correct, correctMeaningId: question.meaningId, verdict };
}

/** Files a correctly-answered question as Done or Ambiguous. */
export async function setVerdict(questionId: string, verdict: "DONE" | "AMBIGUOUS"): Promise<boolean> {
  const question = await db.vocabQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.chosenId === null) return false;
  // A wrong answer is not yours to reclassify.
  if (question.chosenId !== question.meaningId) return false;

  await db.vocabQuestion.update({ where: { id: questionId }, data: { verdict } });
  return true;
}
