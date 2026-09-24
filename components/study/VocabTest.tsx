"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, RotateCcw, X } from "lucide-react";
import { DEFAULT_RUN_LENGTH, RUN_LENGTHS } from "@/lib/vocab";

export interface OptionView {
  id: string;
  text: string;
}

export interface QuestionView {
  id: string;
  word: string;
  /** Which sense of the word this asks about, when the word has more than one. */
  senseOf: { position: number; total: number } | null;
  options: OptionView[];
}

export interface CategoryEntry {
  questionId: string;
  word: string;
  meaning: string;
}

export interface Categories {
  DONE: CategoryEntry[];
  AMBIGUOUS: CategoryEntry[];
  TO_REVIEW: CategoryEntry[];
}

interface Outcome {
  correct: boolean;
  correctMeaningId: string;
}

export default function VocabTest({
  question,
  answered,
  total,
  categories,
  meaningCount,
}: {
  question: QuestionView | null;
  answered: number;
  total: number;
  categories: Categories;
  /** Every meaning in the list — the longest a run could be. */
  meaningCount: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [length, setLength] = useState(Math.min(DEFAULT_RUN_LENGTH, meaningCount));

  async function post(url: string, body: unknown) {
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return null;
    }
    return res.json();
  }

  async function choose(optionId: string) {
    if (!question || outcome) return;
    setBusy(true);
    setPicked(optionId);
    const result = await post(`/api/study/vocab/questions/${question.id}/answer`, { chosenId: optionId });
    if (result) setOutcome(result);
    else setPicked(null);
    setBusy(false);
  }

  async function next(verdict?: "DONE" | "AMBIGUOUS") {
    if (!question) return;
    setBusy(true);
    if (verdict) await post(`/api/study/vocab/questions/${question.id}/verdict`, { verdict });
    setPicked(null);
    setOutcome(null);
    startTransition(() => router.refresh());
    setBusy(false);
  }

  async function restart() {
    setBusy(true);
    setPicked(null);
    setOutcome(null);
    await post("/api/study/vocab/run", { limit: length });
    startTransition(() => router.refresh());
    setBusy(false);
  }

  const finished = total > 0 && answered >= total;

  // The offered lengths, capped at the list, with the whole list always last.
  const lengthChoices = [...new Set([...RUN_LENGTHS.filter((n) => n < meaningCount), meaningCount])];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Progress + restart */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-gray-500 tabular-nums">
            {total === 0 ? "No questions yet" : `${answered} / ${total} answered`}
          </span>
          {total > 0 && (
            <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all"
                style={{ width: `${Math.round((answered / total) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="run-length" className="sr-only">
            Questions per test
          </label>
          <select
            id="run-length"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            disabled={busy}
            className="border border-gray-200 text-gray-700 rounded-lg px-2.5 py-2 text-sm font-semibold bg-white disabled:opacity-50"
          >
            {lengthChoices.map((n) => (
              <option key={n} value={n}>
                {n >= meaningCount ? `All ${meaningCount}` : `${n} questions`}
              </option>
            ))}
          </select>
          <button
            onClick={restart}
            disabled={busy}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {total === 0 ? "Start the test" : "Take the test again"}
          </button>
        </div>
      </div>

      {/* The question */}
      {question && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            What does this mean?
            {question.senseOf && (
              <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">
                sense {question.senseOf.position} of {question.senseOf.total}
              </span>
            )}
          </p>
          <h2 className="text-3xl font-bold text-gray-900 mt-1">{question.word}</h2>

          <ul className="mt-5 space-y-2">
            {question.options.map((option) => {
              const isPicked = picked === option.id;
              const isAnswer = outcome?.correctMeaningId === option.id;
              const reveal = outcome !== null;

              let tone = "border-gray-200 hover:border-gray-400 hover:bg-gray-50";
              if (reveal && isAnswer) tone = "border-emerald-400 bg-emerald-50";
              else if (reveal && isPicked) tone = "border-red-300 bg-red-50";
              else if (reveal) tone = "border-gray-100 opacity-60";

              return (
                <li key={option.id}>
                  <button
                    onClick={() => choose(option.id)}
                    disabled={busy || reveal}
                    className={`w-full text-left border rounded-xl px-4 py-3 text-sm text-gray-900 transition-colors disabled:cursor-default ${tone}`}
                  >
                    <span className="flex items-start gap-2">
                      {reveal && isAnswer && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
                      {reveal && isPicked && !isAnswer && <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                      <span>{option.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {outcome && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              {outcome.correct ? (
                <>
                  <p className="text-sm font-semibold text-emerald-700 mb-3">
                    Correct — how well do you know it?
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => next("DONE")}
                      disabled={busy}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Done
                    </button>
                    <button
                      onClick={() => next("AMBIGUOUS")}
                      disabled={busy}
                      className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      <CircleHelp className="w-4 h-4" /> Ambiguous
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700 mb-3">
                    Not quite — filed under To Review.
                  </p>
                  <button
                    onClick={() => next()}
                    disabled={busy}
                    className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Next question
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {finished && !question && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="font-semibold text-gray-900">That is the whole list.</p>
          <p className="text-sm text-gray-500 mt-1">
            The three lists below hold what you filed. They stay until you take the test again.
          </p>
        </div>
      )}

      {/* The categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CategoryList title="Done" entries={categories.DONE} tone="emerald" />
        <CategoryList title="Ambiguous" entries={categories.AMBIGUOUS} tone="amber" />
        <CategoryList title="To Review" entries={categories.TO_REVIEW} tone="red" />
      </div>
    </div>
  );
}

const TONES = {
  emerald: { head: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  amber: { head: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  red: { head: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500" },
} as const;

function CategoryList({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: CategoryEntry[];
  tone: keyof typeof TONES;
}) {
  const style = TONES[tone];
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 border-b ${style.head}`}>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs tabular-nums">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.questionId} className="px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">{entry.word}</p>
              <p className="text-xs text-gray-500 mt-0.5">{entry.meaning}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
