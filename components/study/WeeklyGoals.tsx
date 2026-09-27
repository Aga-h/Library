"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Pencil, Target, X } from "lucide-react";
import { goalProgress, minutesToHours, paceText, MAX_WEEKLY_GOAL_HOURS, type GoalProgress } from "@/lib/goals";
import { formatDuration } from "@/lib/study";
import { inputCls } from "@/components/ui/form";

export interface ModuleGoalView {
  id: string;
  title: string;
  goalMinutes: number;
  doneSeconds: number;
}

export default function WeeklyGoals({
  today,
  weekLabel,
  overall,
  modules,
}: {
  today: string;
  /** "22–28 Sep", for the header. */
  weekLabel: string;
  overall: { goalMinutes: number | null; doneSeconds: number };
  /** Only modules that have a goal. */
  modules: ModuleGoalView[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(overall.goalMinutes ? String(minutesToHours(overall.goalMinutes)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(hours: number | null) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/study/goal", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  const main = overall.goalMinutes ? goalProgress(overall.goalMinutes, overall.doneSeconds, today) : null;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
          <Target className="w-3.5 h-3.5" /> This week
        </h3>
        <span className="text-xs text-gray-400">{weekLabel}</span>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const hours = Number(draft);
            void save(draft.trim() === "" ? null : hours);
          }}
          className="flex items-center gap-2 flex-wrap"
        >
          <label htmlFor="weekly-goal" className="text-sm text-gray-600">Study</label>
          <input id="weekly-goal" type="number" inputMode="decimal" min="0.25" max={MAX_WEEKLY_GOAL_HOURS} step="0.25"
            value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="20"
            className={`${inputCls} w-24`} />
          <span className="text-sm text-gray-600">hours a week</span>
          <button type="submit" disabled={busy} aria-label="Save goal"
            className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
            <Check className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setEditing(false); setError(null); }} aria-label="Cancel"
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
          {overall.goalMinutes !== null && (
            <button type="button" onClick={() => save(null)} disabled={busy}
              className="text-xs text-gray-400 hover:text-red-600 underline ml-1">Remove goal</button>
          )}
        </form>
      ) : main ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-gray-900">
              <span className="text-xl font-bold tabular-nums">{formatDuration(main.doneSeconds)}</span>
              <span className="text-gray-500"> of {formatDuration(main.goalSeconds)}</span>
            </p>
            <button onClick={() => setEditing(true)} aria-label="Change weekly goal"
              className="p-1.5 text-gray-300 hover:text-gray-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          </div>
          <Bar progress={main} tall />
          <p className="text-xs text-gray-500 mt-1.5">{paceLine(main)}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-500">
            {formatDuration(overall.doneSeconds)} studied so far. No weekly goal yet.
          </p>
          <button onClick={() => setEditing(true)}
            className="text-sm font-semibold text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors">
            Set a weekly goal
          </button>
        </div>
      )}

      {modules.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {modules.map((m) => {
            const p = goalProgress(m.goalMinutes, m.doneSeconds, today);
            return (
              <li key={m.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-gray-900 truncate">{m.title}</span>
                  <span className="text-gray-500 tabular-nums whitespace-nowrap">
                    {formatDuration(p.doneSeconds)} / {formatDuration(p.goalSeconds)}
                  </span>
                </div>
                <Bar progress={p} />
                <p className="text-[11px] text-gray-400 mt-1">{paceLine(p)}</p>
              </li>
            );
          })}
        </ul>
      )}
      {modules.length === 0 && (
        <p className="text-[11px] text-gray-400 mt-3">
          Modules can have their own weekly goal too — set one on{" "}
          <Link href="/study/modules" className="underline hover:text-gray-700">Modules</Link>.
        </p>
      )}
    </section>
  );
}

function Bar({ progress, tall = false }: { progress: GoalProgress; tall?: boolean }) {
  return (
    <div className={`${tall ? "h-2.5 mt-2" : "h-1.5 mt-1"} bg-gray-100 rounded-full overflow-hidden`}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
      <div className={`h-full rounded-full transition-all ${progress.met ? "bg-emerald-500" : "bg-sky-500"}`}
        style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
    </div>
  );
}

function paceLine(p: GoalProgress): string {
  return paceText(p, formatDuration);
}
