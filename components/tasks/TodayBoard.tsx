"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, Play, Square, Timer, XCircle } from "lucide-react";
import { formatDuration, formatStopwatch, viewWorkedSeconds, type TaskView } from "@/lib/tasks";
import { formatRange } from "@/lib/calendar-dates";
import StatBadges from "@/components/tasks/StatBadges";
import type { Stat } from "@/lib/stats";

export interface StudyView {
  id: string;
  stats: Stat[];
  startedAt: string;
}

export default function TodayBoard({
  tasks,
  study,
  canStudy,
  serverNow,
}: {
  tasks: TaskView[];
  /** A free study session running right now, if there is one. */
  study: StudyView | null;
  /** Only today can be studied — you cannot start a session on a date already gone. */
  canStudy: boolean;
  serverNow: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pull fresh server state the moment a window opens or closes.
  const boundaries = tasks
    .filter((t) => t.status === "SCHEDULED" || t.status === "ACTIVE")
    .flatMap((t) => [Date.parse(t.startsAt), Date.parse(t.endsAt)]);
  const nextBoundary = Math.min(...boundaries.filter((b) => b > serverNow), Infinity);
  const refreshed = useRef(false);
  useEffect(() => {
    if (Number.isFinite(nextBoundary) && now >= nextBoundary && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [now, nextBoundary, router]);

  async function studyAct(action: "start" | "stop") {
    setPending("study");
    setError(null);
    const res = await fetch(`/api/study/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    }
    refreshed.current = false;
    router.refresh();
    setPending(null);
  }

  async function act(taskId: string, action: "start" | "stop" | "finish") {
    setPending(taskId);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/${action}`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    }
    refreshed.current = false;
    router.refresh();
    setPending(null);
  }

  const running = tasks.find((t) => t.runningSince !== null);
  const live = tasks.filter(
    (t) => !t.runningSince && t.status !== "COMPLETED" && t.status !== "FAILED" &&
      now >= Date.parse(t.startsAt) && now < Date.parse(t.endsAt),
  );
  const upcoming = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "FAILED" && now < Date.parse(t.startsAt),
  );
  const judged = tasks.filter((t) => t.status === "COMPLETED" || t.status === "FAILED");


  // Nothing scheduled you could be working on this minute — neither running nor startable.
  const nothingToDo = !running && live.length === 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {study && (
        <StudyCard
          study={study}
          now={now}
          pending={pending === "study"}
          onStop={() => studyAct("stop")}
        />
      )}

      {!study && nothingToDo && canStudy && (
        <div className="flex items-center justify-between gap-4 border border-gray-200 bg-white rounded-xl px-5 py-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-gray-300 flex-shrink-0" />
            <p className="text-sm text-gray-600">
              Nothing to work on right now.{" "}
              <span className="text-gray-400">Study anyway and three stats are rolled for it.</span>
            </p>
          </div>
          <button
            onClick={() => studyAct("start")}
            disabled={pending === "study"}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <BookOpen className="w-4 h-4" /> {pending === "study" ? "Rolling…" : "Study"}
          </button>
        </div>
      )}

      {running && (
        <RunnerCard
          task={running}
          now={now}
          pending={pending === running.id}
          onStop={() => act(running.id, "stop")}
          onFinish={() => act(running.id, "finish")}
        />
      )}

      {live.length > 0 && (
        <Section title={running ? "Also running now" : "Happening now"} icon={Timer}>
          {live.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              now={now}
              pending={pending === task.id}
              onStart={() => act(task.id, "start")}
              onFinish={() => act(task.id, "finish")}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Later today" icon={Clock}>
          {upcoming.map((task) => (
            <TaskRow key={task.id} task={task} now={now} pending={false} />
          ))}
        </Section>
      )}

      {judged.length > 0 && (
        <Section title="Judged" icon={CheckCircle2}>
          {judged.map((task) => (
            <TaskRow key={task.id} task={task} now={now} pending={false} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** A free study session in progress: no window, no bar, just the clock and the three stats. */
function StudyCard({
  study,
  now,
  pending,
  onStop,
}: {
  study: StudyView;
  now: number;
  pending: boolean;
  onStop: () => void;
}) {
  const elapsed = Math.max(0, Math.round((now - Date.parse(study.startedAt)) / 1000));
  const minutes = Math.floor(elapsed / 60);

  return (
    <div className="bg-gray-900 text-white rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Free study</p>
          <h2 className="text-2xl font-bold mt-1">Studying</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Nothing was scheduled, so these three were rolled for it.
          </p>
          <div className="mt-3">
            <StatBadges stats={study.stats} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums leading-none">{formatStopwatch(elapsed)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {minutes < 1 ? "no XP yet — a minute earns the first" : `+${minutes} XP to each so far`}
          </p>
        </div>
      </div>

      <button
        onClick={onStop}
        disabled={pending}
        className="flex items-center gap-2 mt-5 bg-white text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        <Square className="w-4 h-4" /> {pending ? "Saving…" : "End session"}
      </button>
    </div>
  );
}

function RunnerCard({
  task,
  now,
  pending,
  onStop,
  onFinish,
}: {
  task: TaskView;
  now: number;
  pending: boolean;
  onStop: () => void;
  onFinish: () => void;
}) {
  const worked = viewWorkedSeconds(task, now);
  const cleared = worked >= task.requiredSeconds;
  const sessionSeconds = task.runningSince
    ? Math.max(0, Math.round((Math.min(now, Date.parse(task.endsAt)) - Date.parse(task.runningSince)) / 1000))
    : 0;
  const left = Math.max(0, Math.round((Date.parse(task.endsAt) - now) / 1000));

  return (
    <div className="bg-gray-900 text-white rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">In session</p>
          <h2 className="text-2xl font-bold mt-1 truncate">{task.title}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatRange(task.startMinute, task.endMinute)} · {formatDuration(left)} of the window left
          </p>
          <div className="mt-3">
            <StatBadges stats={task.stats} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums leading-none">{formatStopwatch(sessionSeconds)}</p>
          <p className="text-[11px] text-gray-400 mt-1">this session</p>
        </div>
      </div>

      <div className="mt-5">
        <ProgressBar task={task} worked={worked} dark />
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={onStop}
          disabled={pending}
          className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          <Square className="w-4 h-4" /> {pending ? "Saving…" : "End session"}
        </button>
        {cleared && (
          <button
            onClick={onFinish}
            disabled={pending}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Finish as done
          </button>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  now,
  pending,
  onStart,
  onFinish,
}: {
  task: TaskView;
  now: number;
  pending: boolean;
  onStart?: () => void;
  onFinish?: () => void;
}) {
  const worked = viewWorkedSeconds(task, now);
  const cleared = worked >= task.requiredSeconds;
  const isFinal = task.status === "COMPLETED" || task.status === "FAILED";

  return (
    <div className={`border rounded-xl p-4 bg-white ${isFinal ? "border-gray-200" : "border-gray-300"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{task.title}</p>
            {task.status === "COMPLETED" && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                <CheckCircle2 className="w-3 h-3" /> COMPLETED
              </span>
            )}
            {task.status === "FAILED" && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-1.5 py-0.5">
                <XCircle className="w-3 h-3" /> FAILED
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatRange(task.startMinute, task.endMinute)} ·{" "}
            {formatDuration(task.scheduledSeconds)} in the day
          </p>
          <div className="mt-2">
            <StatBadges stats={task.stats} size="xs" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onFinish && cleared && (
            <button
              onClick={onFinish}
              disabled={pending}
              className="flex items-center gap-2 border border-emerald-300 text-emerald-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Finish
            </button>
          )}
          {onStart && (
            <button
              onClick={onStart}
              disabled={pending}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-4 h-4" /> {pending ? "Starting…" : worked > 0 ? "Resume" : "Start"}
            </button>
          )}
        </div>
      </div>

      {(worked > 0 || !isFinal) && (
        <div className="mt-3">
          <ProgressBar task={task} worked={worked} />
        </div>
      )}
    </div>
  );
}

/** Booked time as the track, worked time as the fill, the 50% bar as the marker. */
export function ProgressBar({
  task,
  worked,
  dark = false,
}: {
  task: TaskView;
  worked: number;
  dark?: boolean;
}) {
  const ratio = task.scheduledSeconds > 0 ? Math.min(1, worked / task.scheduledSeconds) : 0;
  const cleared = worked >= task.requiredSeconds;
  const judged = task.status === "COMPLETED" || task.status === "FAILED";
  const fill = cleared ? "bg-emerald-500" : task.status === "FAILED" ? "bg-red-400" : "bg-sky-500";
  const trailing = judged
    ? task.status === "COMPLETED"
      ? "bar cleared"
      : `missed by ${formatDuration(task.requiredSeconds - worked)}`
    : cleared
      ? "bar cleared"
      : `${formatDuration(task.requiredSeconds - worked)} to clear`;

  return (
    <div>
      <div className={`relative h-2 rounded-full overflow-hidden ${dark ? "bg-white/15" : "bg-gray-100"}`}>
        <div className={`h-full ${fill} transition-all`} style={{ width: `${ratio * 100}%` }} />
        <div
          className={`absolute top-0 bottom-0 w-px ${dark ? "bg-white/70" : "bg-gray-400"}`}
          style={{ left: "50%" }}
        />
      </div>
      <div className={`flex items-center justify-between mt-1.5 text-[11px] ${dark ? "text-gray-400" : "text-gray-500"}`}>
        <span>
          {formatDuration(worked)} worked · {formatDuration(task.requiredSeconds)} needed
        </span>
        <span
          className={
            cleared
              ? dark ? "text-emerald-400 font-semibold" : "text-emerald-600 font-semibold"
              : task.status === "FAILED" ? "text-red-500 font-semibold" : ""
          }
        >
          {trailing}
        </span>
      </div>
    </div>
  );
}
