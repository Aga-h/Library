"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Layers, Loader2, Settings2, Undo2 } from "lucide-react";
import type { DeckView } from "@/lib/flashcard-service";
import { RATINGS, RATING_LABELS, type Rating } from "@/lib/flashcards";
import { useBringIntoReach } from "@/components/study/useBringIntoReach";

const RATING_STYLE: Record<Rating, string> = {
  1: "bg-red-600 hover:bg-red-700",
  2: "bg-gray-600 hover:bg-gray-700",
  3: "bg-emerald-600 hover:bg-emerald-700",
  4: "bg-sky-600 hover:bg-sky-700",
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Studying the SAT words as flashcards, the way Anki does: the word, then its meanings, then how
 * well you knew it — Again, Hard, Good or Easy — which decides when you see it next. Space shows
 * the answer, 1–4 answer, Z undoes.
 */
export default function Flashcards({ initial }: { initial: DeckView }) {
  const [deck, setDeck] = useState(initial);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [limits, setLimits] = useState(initial.limits);

  const send = useCallback(async (url: string, init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong — try again.");
      setDeck(data as DeckView);
      setShown(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the site — try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const rate = useCallback((rating: Rating) => {
    if (!deck.card || busy) return;
    void send("/api/study/flashcards/answer", {
      method: "POST",
      body: JSON.stringify({ cardId: deck.card.id, rating, reps: deck.card.reps }),
    });
  }, [deck.card, busy, send]);

  const undo = useCallback(() => {
    if (!deck.canUndo || busy) return;
    void send("/api/study/flashcards/undo", { method: "POST" });
  }, [deck.canUndo, busy, send]);

  // Keys, as in Anki: space or enter shows the answer, 1–4 answer, Z undoes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!shown && deck.card && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key) as Rating);
      } else if (e.key === "z" || e.key === "Z") {
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, deck.card, rate, undo]);

  // A learning card coming due later: fetch again when it does.
  useEffect(() => {
    if (deck.card || !deck.waitUntil) return;
    const wait = Math.max(1000, new Date(deck.waitUntil).getTime() - Date.now() + 500);
    const timer = setTimeout(() => void send("/api/study/flashcards", { method: "GET" }), Math.min(wait, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [deck.card, deck.waitUntil, send]);

  // Show answer, then the four ratings: whichever is up, keep it on a phone's screen.
  const actions = useBringIntoReach<HTMLDivElement>(`${deck.card?.id ?? ""}:${shown}`);

  const { summary } = deck;
  const state = deck.card?.state;

  return (
    <div className="space-y-5">
      {/* Anki's three numbers: new, learning, to review. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-1 text-sm tabular-nums" aria-label="Today">
          <span><span className={`font-bold text-sky-600 ${state === "NEW" ? "underline underline-offset-4" : ""}`}>{summary.new}</span> <span className="text-gray-500">new</span></span>
          <span><span className={`font-bold text-red-600 ${state === "LEARNING" || state === "RELEARNING" ? "underline underline-offset-4" : ""}`}>{summary.learning}</span> <span className="text-gray-500">learning</span></span>
          <span><span className={`font-bold text-emerald-600 ${state === "REVIEW" ? "underline underline-offset-4" : ""}`}>{summary.review}</span> <span className="text-gray-500">to review</span></span>
          <span className="text-gray-400">· {deck.total} cards</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={undo} disabled={!deck.canUndo || busy} title="Undo the last answer (Z)"
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 transition-colors">
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 max-sm:py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors">
            <Settings2 className="w-3.5 h-3.5" /> Daily limits
          </button>
        </div>
      </div>

      {editing && (
        <form className="flex items-end gap-3 flex-wrap bg-white border border-gray-200 rounded-xl p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send("/api/study/flashcards/settings", { method: "PUT", body: JSON.stringify(limits) }).then(() => setEditing(false));
          }}>
          <label className="text-xs font-semibold text-gray-500">
            New cards a day
            <input type="number" min={0} max={9999} value={limits.newPerDay}
              onChange={(e) => setLimits({ ...limits, newPerDay: Number(e.target.value) })}
              className="block mt-1 w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900" />
          </label>
          <label className="text-xs font-semibold text-gray-500">
            Reviews a day
            <input type="number" min={0} max={9999} value={limits.reviewsPerDay}
              onChange={(e) => setLimits({ ...limits, reviewsPerDay: Number(e.target.value) })}
              className="block mt-1 w-28 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900" />
          </label>
          <button type="submit" disabled={busy}
            className="bg-gray-900 text-white px-3 py-2 max-sm:px-4 max-sm:py-3 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50">Save</button>
        </form>
      )}

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {deck.card ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 pt-10 pb-8 text-center min-h-[11rem] flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {state === "NEW" ? "New" : state === "REVIEW" ? "Review" : "Learning"}
            </p>
            <h2 className="text-4xl max-sm:text-3xl font-bold text-gray-900 mt-2 break-words">{deck.card.word}</h2>
          </div>

          {shown ? (
            <>
              <div className="border-t border-gray-100 px-6 py-6">
                <ol className="space-y-2 max-w-xl mx-auto">
                  {deck.card.meanings.map((m, i) => (
                    <li key={i} className="flex gap-3 text-gray-800">
                      {deck.card!.meanings.length > 1 && <span className="text-gray-400 tabular-nums font-semibold">{i + 1}.</span>}
                      <span>{m}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div ref={actions} className="scroll-mt-20 scroll-mb-4 border-t border-gray-100 bg-gray-50 px-4 py-4 grid grid-cols-4 gap-2 max-sm:px-3 max-sm:gap-1.5">
                {RATINGS.map((r) => (
                  <button key={r} type="button" onClick={() => rate(r)} disabled={busy}
                    className={`flex flex-col items-center gap-0.5 text-white rounded-lg px-2 py-2.5 max-sm:py-3 text-sm font-semibold disabled:opacity-50 transition-colors ${RATING_STYLE[r]}`}>
                    <span className="text-[11px] font-medium opacity-90 tabular-nums">{deck.card!.labels[r]}</span>
                    {RATING_LABELS[r]}
                    <span className="hidden sm:block text-[10px] font-normal opacity-70">{r}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div ref={actions} className="scroll-mt-20 scroll-mb-4 border-t border-gray-100 bg-gray-50 px-4 py-4">
              <button type="button" onClick={() => setShown(true)} disabled={busy}
                className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <>Show answer <span className="hidden sm:inline text-xs font-normal opacity-70">· space</span></>}
              </button>
            </div>
          )}
        </div>
      ) : deck.total === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No cards yet</p>
          <p className="text-sm text-gray-500 mt-1">Add the word list first — every word becomes a card.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Check className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">Done for now.</p>
          <p className="text-sm text-gray-500 mt-1">
            {deck.waitUntil
              ? `A card you're learning comes back at ${timeOf(deck.waitUntil)} — this page will show it then.`
              : `${deck.answeredToday} answered today. Tomorrow's cards are ready from 4am.`}
          </p>
        </div>
      )}
    </div>
  );
}
