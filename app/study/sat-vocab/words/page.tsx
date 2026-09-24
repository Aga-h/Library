export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { SAT_VOCAB_WORD_COUNT } from "@/lib/sat-vocab-list";
import VocabImport from "@/components/study/VocabImport";

export default async function VocabWordsPage() {
  const words = await db.vocabWord.findMany({
    orderBy: { word: "asc" },
    include: { meanings: { orderBy: { position: "asc" } } },
  });
  const meaningCount = words.reduce((n, w) => n + w.meanings.length, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/study/sat-vocab"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to the test
      </Link>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Word list</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {words.length} word{words.length === 1 ? "" : "s"}, {meaningCount} meaning
          {meaningCount === 1 ? "" : "s"} — so {meaningCount} question
          {meaningCount === 1 ? "" : "s"} in a full test.
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Add words</h3>
        <VocabImport builtinSize={SAT_VOCAB_WORD_COUNT} />
      </section>

      {words.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide px-5 py-3 border-b border-gray-100">
            In the list
          </h3>
          <ul className="divide-y divide-gray-50">
            {words.map((word) => (
              <li key={word.id} className="px-5 py-3">
                <p className="font-semibold text-gray-900 text-sm">{word.word}</p>
                <ol className="mt-1 space-y-0.5">
                  {word.meanings.map((meaning) => (
                    <li key={meaning.id} className="text-xs text-gray-500">
                      {word.meanings.length > 1 && (
                        <span className="text-gray-300 tabular-nums mr-1.5">{meaning.position}.</span>
                      )}
                      {meaning.text}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
