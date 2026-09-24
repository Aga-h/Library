// Database side of the vocabulary test. Pure rules live in lib/vocab.ts.

import type { VocabVerdict } from "@prisma/client";
import { db } from "@/lib/db";
import { SAT_VOCAB_LIST } from "@/lib/sat-vocab-list";
import { buildQuestions, parseWordList } from "@/lib/vocab";

export interface ImportSummary {
  wordsAdded: number;
  wordsUpdated: number;
  wordsUnchanged: number;
  meaningsTotal: number;
  skipped: { line: number; text: string; reason: string }[];
}

/** Imports the list that ships with the repo, through the same path as a pasted one. */
export function importBuiltinList(): Promise<ImportSummary> {
  return importWordList(SAT_VOCAB_LIST);
}

/**
 * Replaces a word's meanings with the imported ones, leaving words not mentioned alone.
 *
 * Two things shape how this is written:
 *
 *  - It runs in batches, not a query per word. The built-in list is a thousand words, and a
 *    thousand round trips to a hosted database is a request that times out.
 *  - A word whose meanings are unchanged is left completely untouched. Meanings cascade to
 *    questions, so rewriting a word deletes the current run's question about it -- re-importing
 *    the same list would quietly empty a test in progress.
 */
export async function importWordList(input: string): Promise<ImportSummary> {
  const { words, skipped } = parseWordList(input);
  const meaningsTotal = words.reduce((n, w) => n + w.meanings.length, 0);
  if (words.length === 0) {
    return { wordsAdded: 0, wordsUpdated: 0, wordsUnchanged: 0, meaningsTotal: 0, skipped };
  }

  const existing = await db.vocabWord.findMany({
    where: { word: { in: words.map((w) => w.word) } },
    select: { id: true, word: true, meanings: { orderBy: { position: "asc" }, select: { text: true } } },
  });
  const byWord = new Map(existing.map((w) => [w.word, w]));

  const toCreate = words.filter((w) => !byWord.has(w.word));
  const toRewrite = words.filter((entry) => {
    const found = byWord.get(entry.word);
    if (!found) return false;
    const before = found.meanings.map((m) => m.text);
    return before.length !== entry.meanings.length || before.some((t, i) => t !== entry.meanings[i]);
  });

  if (toCreate.length > 0) {
    await db.vocabWord.createMany({
      data: toCreate.map((w) => ({ word: w.word })),
      skipDuplicates: true,
    });
    const created = await db.vocabWord.findMany({
      where: { word: { in: toCreate.map((w) => w.word) } },
      select: { id: true, word: true, meanings: { select: { text: true } } },
    });
    for (const w of created) byWord.set(w.word, w);
  }

  const rewritten = [...toCreate, ...toRewrite];
  if (rewritten.length > 0) {
    const ids = rewritten.map((w) => byWord.get(w.word)?.id).filter((id): id is string => Boolean(id));
    // Meanings are positional, so the simplest correct update is to lay them down again.
    await db.vocabMeaning.deleteMany({ where: { wordId: { in: ids } } });
    await db.vocabMeaning.createMany({
      data: rewritten.flatMap((entry) => {
        const wordId = byWord.get(entry.word)?.id;
        if (!wordId) return [];
        return entry.meanings.map((text, i) => ({ wordId, text, position: i + 1 }));
      }),
    });
  }

  return {
    wordsAdded: toCreate.length,
    wordsUpdated: toRewrite.length,
    wordsUnchanged: words.length - toCreate.length - toRewrite.length,
    meaningsTotal,
    skipped,
  };
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
 * Starts a fresh run: `limit` questions drawn from the whole list, shuffled, distractors taken
 * from every word rather than only the ones being asked about.
 *
 * This is what "take the test again" does, and it is what resets the three categories -- they are
 * the verdicts on the current run's questions, so a new run starts them empty.
 */
export async function startRun(limit?: number) {
  const meanings = await db.vocabMeaning.findMany({ select: { id: true, wordId: true, text: true } });
  if (meanings.length === 0) return null;

  const built = buildQuestions(meanings, { limit });
  if (built.length === 0) return null;

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
