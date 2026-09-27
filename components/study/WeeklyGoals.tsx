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
  /** Null until you set one. */
  goalMinutes: number | null;
  doneSeconds: number;
}

/** Sends a goal and says what went wrong, or null when it saved. */
type SaveGoal = (hours: number | null) => Promise<string | null>;

async function send(url: string, method: "PUT" | "PATCH", body: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const d = await res.json().catch(() => ({}));
  return d.error ?? d.issues?.[0]?.message ?? "Something went wrong";
}

/**
 * The week's goals: the overall one first, then one row for every module you can study, each with
 * its own goal set right here — a module without one says so and offers to set it.
 */
export default function WeeklyGoals({
  today,
  weekLabel,
  overall,
  modules,
}: {
  today: string;
  /** "21–27 Sep", for the header. */
  weekLabel: string;
  overall: { goalMinutes: number | null; doneSeconds: number };
  /** Every module that can be studied, goal or not. */
  modules: ModuleGoalView[];
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
          <Target className="w-3.5 h-3.5" /> This week
        </h3>
        <span className="text-xs text-gray-400">{weekLabel}</span>
      </div>

      <GoalRow
        rowId="overall"
        label="All study"
        big
        today={today}
        goalMinutes={overall.goalMinutes}
        doneSeconds={overall.doneSeconds}
        save={(hours) => send("/api/study/goal", "PUT", { hours })}
      />

      {modules.length > 0 ? (
        <ul className="mt-4 pt-4 border-t border-gray-100 space-y-3.5">
          {modules.map((m) => (
            <li key={m.id}>
              <GoalRow
                rowId={m.id}
                label={m.title}
                today={today}
                goalMinutes={m.goalMinutes}
                doneSeconds={m.doneSeconds}
                save={(hours) => send(`/api/study/modules/${m.id}`, "PATCH", { weeklyGoalHours: hours })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400 mt-3">
          <Link href="/study/modules" className="underline hover:text-gray-700">Make a module</Link> and it
          gets its own weekly goal here.
        </p>
      )}
    </section>
  );
}

function GoalRow({
  rowId,
  label,
  today,
  goalMinutes,
  doneSeconds,
  save,
  big = false,
}: {
  /** Unique per row — the input's id is built from it, never from a title two modules could share. */
  rowId: string;
  label: string;
  today: string;
  goalMinutes: number | null;
  doneSeconds: number;
  save: SaveGoal;
  big?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goalMinutes ? String(minutesToHours(goalMinutes)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(hours: number | null) {
    setBusy(true);
    setError(null);
    const problem = await save(hours);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  const progress = goalMinutes ? goalProgress(goalMinutes, doneSeconds, today) : null;
  const inputId = `weekly-goal-${rowId}`;

  if (editing) {
    return (
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft.trim() === "" ? null : Number(draft));
          }}
          className="flex items-center gap-2 flex-wrap"
        >
          <label htmlFor={inputId} className={`font-semibold text-gray-900 ${big ? "text-base" : "text-sm"}`}>
            {label}
          </label>
          <input id={inputId} type="number" inputMode="decimal" min="0.25" max={MAX_WEEKLY_GOAL_HOURS} step="0.25"
            value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="hours"
            className={`${inputCls} w-24 text-sm`} />
          <span className="text-sm text-gray-500">hours a week</span>
          <button type="submit" disabled={busy} aria-label={`Save goal for ${label}`}
            className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
            <Check className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setEditing(false); setError(null); }} aria-label="Cancel"
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
          {goalMinutes !== null && (
            <button type="button" onClick={() => submit(null)} disabled={busy}
              className="text-xs text-gray-400 hover:text-red-600 underline">Remove goal</button>
          )}
        </form>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-semibold text-gray-900 truncate ${big ? "text-base" : "text-sm"}`}>{label}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={`tabular-nums ${big ? "text-sm text-gray-900" : "text-sm text-gray-500"}`}>
            {progress ? (
              <>
                <span className={big ? "text-lg font-bold" : ""}>{formatDuration(progress.doneSeconds)}</span>
                <span className="text-gray-500"> / {formatDuration(progress.goalSeconds)}</span>
              </>
            ) : (
              `${formatDuration(doneSeconds)} this week`
            )}
          </span>
          {progress ? (
            <button onClick={() => setEditing(true)} aria-label={`Change goal for ${label}`}
              className="p-1 text-gray-300 hover:text-gray-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          ) : (
            <button onClick={() => setEditing(true)}
              className="text-xs font-semibold text-sky-700 border border-sky-200 bg-sky-50 rounded-md px-2 py-0.5 hover:bg-sky-100 transition-colors">
              Set goal
            </button>
          )}
        </span>
      </div>
      {progress && (
        <>
          <Bar progress={progress} tall={big} />
          <p className={`mt-1 ${big ? "text-xs text-gray-500" : "text-[11px] text-gray-400"}`}>
            {paceText(progress, formatDuration)}
          </p>
        </>
      )}
    </div>
  );
}

function Bar({ progress, tall = false }: { progress: GoalProgress; tall?: boolean }) {
  return (
    <div className={`${tall ? "h-2.5 mt-2" : "h-1.5 mt-1.5"} bg-gray-100 rounded-full overflow-hidden`}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
      <div className={`h-full rounded-full transition-all ${progress.met ? "bg-emerald-500" : "bg-sky-500"}`}
        style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
    </div>
  );
}
