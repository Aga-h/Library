export const dynamic = "force-dynamic";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { currentRun } from "@/lib/vocab-service";
import VocabTest, {
  type Categories,
  type CategoryEntry,
  type QuestionView,
} from "@/components/study/VocabTest";

export default async function SatVocabPage() {
  const [wordCount, run] = await Promise.all([db.vocabWord.count(), currentRun()]);

  const questions = run?.questions ?? [];
  const answered = questions.filter((q) => q.verdict !== null).length;

  // The first unanswered question is the one to show.
  const next = questions.find((q) => q.verdict === null) ?? null;

  let question: QuestionView | null = null;
  if (next) {
    // Option text lives on other words' meanings, so resolve just this question's four.
    const options = await db.vocabMeaning.findMany({
      where: { id: { in: next.optionIds } },
      select: { id: true, text: true },
    });
    const byId = new Map(options.map((o) => [o.id, o.text]));
    const senseCount = await db.vocabMeaning.count({ where: { wordId: next.meaning.wordId } });

    question = {
      id: next.id,
      word: next.meaning.word.word,
      senseOf: senseCount > 1 ? { position: next.meaning.position, total: senseCount } : null,
      // optionIds is already shuffled; keep that order.
      options: next.optionIds
        .filter((id) => byId.has(id))
        .map((id) => ({ id, text: byId.get(id)! })),
    };
  }

  const categories: Categories = { DONE: [], AMBIGUOUS: [], TO_REVIEW: [] };
  for (const q of questions) {
    if (q.verdict === null) continue;
    const entry: CategoryEntry = {
      questionId: q.id,
      word: q.meaning.word.word,
      meaning: q.meaning.text,
    };
    categories[q.verdict].push(entry);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SAT Vocabulary</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            One question per meaning. Get it right and file it as Done or Ambiguous; get it wrong
            and it goes to To Review by itself.
          </p>
        </div>
        <Link
          href="/study/sat-vocab/words"
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
        >
          <ListChecks className="w-4 h-4" /> {wordCount} word{wordCount === 1 ? "" : "s"}
        </Link>
      </div>

      {wordCount === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <ListChecks className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No words yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Paste a vocabulary list and the questions build themselves from it.
          </p>
          <Link
            href="/study/sat-vocab/words"
            className="inline-flex items-center gap-2 mt-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <ListChecks className="w-4 h-4" /> Add the word list
          </Link>
        </div>
      ) : (
        <VocabTest
          question={question}
          answered={answered}
          total={questions.length}
          categories={categories}
          hasWords={wordCount > 0}
        />
      )}
    </div>
  );
}
