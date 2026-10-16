"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Play, X } from "lucide-react";
import { QUICK_SIZES, type QuickPool } from "@/lib/vocab";
import { useBringIntoReach } from "@/components/study/useBringIntoReach";

export interface QuickQuestion {
  id: string;
  word: string;
  options: { id: string; text: string }[];
}

export interface QuickResult {
  pool: string;
  total: number;
  correct: number;
  missed: { word: string; meaning: string }[];
}

interface Outcome {
  correct: boolean;
  correctMeaningId: string;
}

/**
 * A short multiple-choice test from one pool of words. Answer, see whether it was right, move on;
 * at the end, the score and what was missed. Nothing here touches the full test.
 */
export default function QuickTest({
  question,
  progress,
  result,
  pools,
}: {
  question: QuickQuestion | null;
  progress: { answered: number; total: number };
  result: QuickResult | null;
  pools: { pool: QuickPool; label: string; count: number }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pool, setPool] = useState<QuickPool>(pools.find((p) => p.count > 0)?.pool ?? "all");
  const [size, setSize] = useState<number>(QUICK_SIZES[1]);
  const [starting, setStarting] = useState(!question);

  async function post(url: string, body: unknown) {
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return null;
    }
    return data;
  }

  async function start() {
    setBusy(true);
    const run = await post("/api/study/vocab/quick", { pool, size });
    if (run) {
      setPicked(null);
      setOutcome(null);
      setStarting(false);
      startTransition(() => router.refresh());
    }
    setBusy(false);
  }

  async function choose(optionId: string) {
    if (!question || outcome || busy) return;
    setBusy(true);
    setPicked(optionId);
    const result = await post(`/api/study/vocab/questions/${question.id}/answer`, { chosenId: optionId });
    if (result) setOutcome(result);
    else setPicked(null);
    setBusy(false);
  }

  function next() {
    setPicked(null);
    setOutcome(null);
    startTransition(() => router.refresh());
  }

  const chosen = pools.find((p) => p.pool === pool);
  // Once answered, the Next button is the thumb's next stop on a phone.
  const after = useBringIntoReach<HTMLDivElement>(outcome);

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {result && !question && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Last quick test · {result.pool}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">
            {result.correct} / {result.total}
            <span className="text-base font-semibold text-gray-500 ml-2">{Math.round((result.correct / result.total) * 100)}%</span>
          </p>
          {result.missed.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-gray-700 mt-4 mb-2">Missed</p>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-72 overflow-y-auto">
                {result.missed.map((m, i) => (
                  <li key={i} className="px-3 py-2">
                    <p className="text-sm font-semibold text-gray-900">{m.word}</p>
                    <p className="text-xs text-gray-500">{m.meaning}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-emerald-700 font-semibold mt-3">Nothing missed.</p>}
        </div>
      )}

      {(starting || !question) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <p className="font-semibold text-gray-900">{result || question ? "New quick test" : "Start a quick test"}</p>
          <div>
            <span className="block text-xs font-semibold text-gray-500 mb-1.5">Questions from</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Questions from">
              {pools.map((p) => (
                <button key={p.pool} type="button" role="radio" aria-checked={pool === p.pool} disabled={p.count === 0}
                  onClick={() => setPool(p.pool)}
                  className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 ${
                    pool === p.pool ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}>
                  <span className="font-semibold">{p.label}</span>
                  <span className="text-xs tabular-nums opacity-70">{p.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 mb-1.5">How many</span>
            <div className="flex gap-2" role="radiogroup" aria-label="How many">
              {QUICK_SIZES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} onClick={() => setSize(n)}
                  className={`border rounded-lg px-3.5 py-1.5 max-sm:flex-1 max-sm:py-2.5 text-sm font-semibold tabular-nums transition-colors ${
                    size === n ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}>{n}</button>
              ))}
            </div>
            {chosen && chosen.count > 0 && chosen.count < size && (
              <p className="text-[11px] text-gray-500 mt-1.5">That pool has {chosen.count} — the test asks all of them.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={start} disabled={busy || !chosen || chosen.count === 0}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 max-sm:flex-1 max-sm:justify-center max-sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
              <Play className="w-4 h-4" /> Start
            </button>
            {question && (
              <button type="button" onClick={() => setStarting(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-800 px-2 max-sm:py-3">Back to the test</button>
            )}
          </div>
        </div>
      )}

      {question && !starting && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm text-gray-500 tabular-nums whitespace-nowrap">{progress.answered} / {progress.total}</span>
              <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.round((progress.answered / Math.max(1, progress.total)) * 100)}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => setStarting(true)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 whitespace-nowrap max-sm:py-3 max-sm:-my-3 max-sm:pl-2">
              Start a different one
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-sm:p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">What does this mean?</p>
            <h2 className="text-3xl font-bold text-gray-900 mt-1 break-words">{question.word}</h2>
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
                    <button type="button" onClick={() => choose(option.id)} disabled={busy || reveal}
                      className={`w-full text-left border rounded-xl px-4 py-3 text-sm text-gray-900 transition-colors disabled:cursor-default ${tone}`}>
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
              <div ref={after} className="scroll-mt-20 scroll-mb-4 mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${outcome.correct ? "text-emerald-700" : "text-red-700"}`}>
                  {outcome.correct ? "Correct." : "Not quite."}
                </p>
                <button type="button" onClick={next} autoFocus
                  className="bg-gray-900 text-white px-4 py-2.5 max-sm:flex-1 max-sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
                  {progress.answered + 1 >= progress.total ? "See the score" : "Next question"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
