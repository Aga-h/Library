"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, Play, Shuffle, Square, Timer } from "lucide-react";
import { formatDuration, formatStopwatch, runningSeconds, xpForSeconds,
  type ModuleView, type RunningSessionView, type SessionView } from "@/lib/study";
import StatBadges from "@/components/study/StatBadges";

export default function SessionBoard({
  running,
  modules,
  today,
  serverNow,
}: {
  running: RunningSessionView | null;
  modules: ModuleView[];
  today: SessionView[];
  /** The server's clock at render, so the first frame matches and the tick can take over. */
  serverNow: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  const elapsed = running ? runningSeconds(running, now) : 0;
  const studiedToday = today.reduce((n, s) => n + s.seconds, 0) + elapsed;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {running ? (
        <section className="bg-gray-900 text-white rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {running.moduleTitle ? "Studying" : "Free study"}
              </p>
              <h3 className="text-2xl font-bold mt-1 truncate">
                {running.moduleTitle ?? "Whatever this is"}
              </h3>
              <div className="mt-3">
                <StatBadges stats={running.stats} size="xs" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold tabular-nums leading-none">{formatStopwatch(elapsed)}</p>
              <p className="text-xs text-gray-400 mt-1.5">
                +{xpForSeconds(elapsed).toLocaleString()} XP
                {running.stats.length > 1 && <span className="text-gray-500"> each</span>} so far
              </p>
            </div>
          </div>
          <button
            onClick={() => post("/api/study/stop", {})}
            disabled={busy}
            className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors mt-5"
          >
            <Square className="w-4 h-4" /> {busy ? "Stopping…" : "Stop and bank it"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Under a minute pays nothing — XP is one per whole minute studied.
          </p>
        </section>
      ) : (
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Start studying</h3>
          <p className="text-sm text-gray-500 mb-4">
            Pick what you are studying and the session pays that module&apos;s stats.
          </p>

          {modules.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center mb-4">
              <Layers className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No modules yet —{" "}
                <Link href="/study/modules" className="font-semibold text-gray-900 underline">make one</Link>{" "}
                to choose the stats it trains.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              {modules.map((m) => {
                // Modules carried over from the old calendar can have no stats — they were plain
                // events. Starting one would pay nothing, so send it to be fixed instead.
                const unusable = m.stats.length === 0;
                return (
                  <li key={m.id}>
                    {unusable ? (
                      <Link
                        href="/study/modules"
                        className="block border border-dashed border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="block font-semibold text-gray-400 text-sm truncate">{m.title}</span>
                        <span className="block text-xs text-amber-600 mt-1">
                          No stats yet — give it one to study it
                        </span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => post("/api/study/start", { moduleId: m.id })}
                        disabled={busy}
                        className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900 text-sm truncate">{m.title}</span>
                            <span className="block mt-1.5"><StatBadges stats={m.stats} size="xs" /></span>
                          </span>
                          <Play className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => post("/api/study/start", { moduleId: null })}
              disabled={busy}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <Shuffle className="w-4 h-4" /> Free study
            </button>
            <p className="text-xs text-gray-400 mt-2">
              For one-off work not worth naming — three stats rolled at random.
            </p>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Today</h3>
          <span className="text-xs text-gray-500 tabular-nums">
            <Timer className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-gray-300" />
            {formatDuration(studiedToday)} studied
          </span>
        </div>
        {today.length === 0 ? (
          <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl px-4 py-6 text-center">
            Nothing banked yet today.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {today.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {s.moduleTitle ?? "Free study"}
                  </p>
                  <p className="text-xs text-gray-500">{formatDuration(s.seconds)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatBadges stats={s.stats} size="xs" />
                  <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                    +{s.xp.toLocaleString()} XP
                    {s.stats.length > 1 && <span className="font-normal text-gray-400"> each</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
