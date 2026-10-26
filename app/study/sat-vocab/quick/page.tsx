export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { QUICK_POOLS, QUICK_POOL_LABELS } from "@/lib/vocab";
import { currentQuickRun, poolMeaningIds } from "@/lib/vocab-service";
import { listModules, openSession, toRunningView } from "@/lib/study-service";
import QuickTest, { type QuickQuestion, type QuickResult } from "@/components/study/QuickTest";
import SatVocabQuickStart from "@/components/study/SatVocabQuickStart";

export default async function QuickTestPage() {
  const now = new Date();
  const [run, meaningCount, modules, runningSession] = await Promise.all([
    currentQuickRun(),
    db.vocabMeaning.count(),
    listModules(),
    openSession(),
  ]);
  const pools = await Promise.all(QUICK_POOLS.map(async (pool) => {
    const ids = await poolMeaningIds(pool);
    return { pool, label: QUICK_POOL_LABELS[pool], count: ids ? ids.size : meaningCount };
  }));

  const questions = run?.questions ?? [];
  const next = questions.find((q) => q.chosenId === null) ?? null;
  const answered = questions.filter((q) => q.chosenId !== null);

  let question: QuickQuestion | null = null;
  if (next) {
    const options = await db.vocabMeaning.findMany({ where: { id: { in: next.optionIds } }, select: { id: true, text: true } });
    const byId = new Map(options.map((o) => [o.id, o.text]));
    question = {
      id: next.id,
      word: next.meaning.word.word,
      // optionIds is already shuffled; keep that order.
      options: next.optionIds.filter((id) => byId.has(id)).map((id) => ({ id, text: byId.get(id)! })),
    };
  }

  const result: QuickResult | null = run && !next && questions.length > 0 ? {
    pool: QUICK_POOL_LABELS[run.pool as keyof typeof QUICK_POOL_LABELS] ?? "Quick test",
    total: questions.length,
    correct: answered.filter((q) => q.chosenId === q.meaningId).length,
    missed: answered.filter((q) => q.chosenId !== q.meaningId).map((q) => ({ word: q.meaning.word.word, meaning: q.meaning.text })),
  } : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Quick test</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          A short test from the words you pick. It stands on its own — the full test, where it is and
          its Done / Ambiguous / To Review lists stay exactly as they are.
        </p>
      </div>
      <SatVocabQuickStart
        modules={modules.map((m) => ({ id: m.id, title: m.title, stats: m.stats }))}
        running={runningSession ? { ...toRunningView(runningSession), moduleId: runningSession.moduleId } : null}
        serverNow={now.getTime()}
      />
      <QuickTest
        question={question}
        progress={{ answered: answered.length, total: questions.length }}
        result={result}
        pools={pools}
      />
    </div>
  );
}
