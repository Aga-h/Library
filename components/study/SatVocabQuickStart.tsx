"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Square } from "lucide-react";
import {
  formatStopwatch,
  runningSeconds,
  xpForSeconds,
  type RunningSessionView,
} from "@/lib/study";
import StatBadges from "@/components/study/StatBadges";

export interface SatVocabModule {
  id: string;
  title: string;
  stats: RunningSessionView["stats"];
}

/**
 * Starts the one study session — the same `/api/study/start` the Study page uses — for the SAT
 * vocabulary module, and stops it the same way. It does not build a test run: "Start the test"
 * already does that, and a second start would wipe the one in progress.
 */
export default function SatVocabQuickStart({
  module,
  running,
  serverNow,
}: {
  /** The SAT vocabulary module, or null when nothing is named that. */
  module: SatVocabModule | null;
  /** The open session, and whether it is `module`. Null when nothing is running. */
  running: { same: boolean; session: RunningSessionView } | null;
  /** The server's clock at render, so the first frame matches and the tick can take over. */
  serverNow: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  // A refresh (starting, stopping, answering a question) brings a new server clock. Pick it up
  // during render so the stopwatch matches that response instead of the clock from first load.
  const [synced, setSynced] = useState(serverNow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A second click can land before React re-renders `busy`. The server also refuses a second
  // open session; this just keeps the button from firing the request twice.
  const inflight = useRef(false);

  if (synced !== serverNow) {
    setSynced(serverNow);
    setNow(serverNow);
  }

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function post(url: string, body: unknown) {
    if (inflight.current) return null;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong");
        // The clock may already have moved (stopped elsewhere). Catch the panel up.
        router.refresh();
        return null;
      }
      await router.refresh();
      return data as { id?: string; moduleId?: string | null; moduleTitle?: string | null };
    } catch {
      setError("Something went wrong");
      return null;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function start() {
    if (!module || module.stats.length === 0 || running) return;
    const data = await post("/api/study/start", { moduleId: module.id });
    if (!data) return;
    // Starting while something else is open returns that session untouched. Say so — a refresh
    // then shows it, and no second timer was created.
    // A successful start of this module has no moduleId only when the response couldn't carry
    // it; the refresh above is what shows the timer. A different id means something else was
    // already open and was left running.
    if (data.moduleId && data.moduleId !== module.id) {
      const name = data.moduleTitle ?? "Free study";
      setError(`${name} is already running. Stop it, then start SAT Vocabulary here.`);
    }
  }

  async function stopAndStart() {
    const stopped = await post("/api/study/stop", {});
    if (!stopped || !module || module.stats.length === 0) return;
    await post("/api/study/start", { moduleId: module.id });
  }

  const elapsed = running ? runningSeconds(running.session, now) : 0;

  let body: ReactNode;
  if (running?.same) {
    const session = running.session;
    body = (
      <section className="bg-gray-900 text-white rounded-2xl px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Studying</p>
            <h3 className="text-2xl font-bold mt-1 break-words sm:truncate">
              {session.moduleTitle ?? module?.title ?? "SAT vocabulary"}
            </h3>
            <div className="mt-3">
              <StatBadges stats={session.stats} size="xs" />
            </div>
          </div>
          <div className="text-right max-sm:text-left">
            <p className="text-4xl font-bold tabular-nums leading-none">{formatStopwatch(elapsed)}</p>
            <p className="text-xs text-gray-400 mt-1.5">
              +{xpForSeconds(elapsed).toLocaleString()} XP
              {session.stats.length > 1 && <span className="text-gray-500"> each</span>} so far
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => post("/api/study/stop", {})}
          disabled={busy}
          className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2.5 max-sm:w-full max-sm:justify-center max-sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors mt-5"
        >
          <Square className="w-4 h-4" /> {busy ? "Stopping…" : "Stop and bank it"}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Under a minute pays nothing — XP is one per whole minute studied.
        </p>
      </section>
    );
  } else if (running) {
    const name = running.session.moduleTitle ?? "Free study";
    body = (
      <section className="bg-white border border-gray-200 rounded-2xl px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Study session</p>
            <p className="text-sm font-semibold text-gray-900 mt-1 break-words">{name} is already running</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {module && module.stats.length > 0
                ? "One session at a time. Stopping it banks whatever it has earned, then SAT Vocabulary starts."
                : "One session at a time. Stop it here, or open Study."}
            </p>
          </div>
          <button
            type="button"
            onClick={stopAndStart}
            disabled={busy}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 max-sm:w-full max-sm:justify-center max-sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Square className="w-4 h-4" /> {busy ? "Switching…" : module && module.stats.length > 0 ? "Stop it and start" : "Stop it"}
          </button>
        </div>
      </section>
    );
  } else if (!module) {
    body = (
      <section className="border border-dashed border-gray-300 rounded-xl px-4 py-4 text-sm text-gray-600">
        Study hours are kept on a module.{" "}
        <Link href="/study/modules" className="font-semibold text-gray-900 underline">
          Name one SAT vocabulary
        </Link>{" "}
        and it can be started from here.
      </section>
    );
  } else if (module.stats.length === 0) {
    body = (
      <Link
        href="/study/modules"
        className="block border border-dashed border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="block font-semibold text-gray-400 text-sm break-words">{module.title}</span>
        <span className="block text-xs text-amber-600 mt-1">No stats yet — give it one to study it</span>
      </Link>
    );
  } else {
    body = (
      <section className="bg-white border border-gray-200 rounded-2xl px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Study session</p>
            <p className="text-sm text-gray-500 mt-1">
              The same timer as Study. It pays {module.title}&apos;s stats.
            </p>
            <div className="mt-2">
              <StatBadges stats={module.stats} size="xs" />
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 max-sm:w-full max-sm:justify-center max-sm:py-3 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Play className="w-4 h-4" /> {busy ? "Starting…" : "Start SAT Vocabulary"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {body}
    </div>
  );
}
