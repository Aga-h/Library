"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { MODULE_COLOR_META } from "@/lib/stats";
import type { ModuleView, TaskView } from "@/lib/tasks";
import { clockFromMinutes, formatDuration, parseClock } from "@/lib/time";
import StatBadges from "@/components/tasks/StatBadges";

export interface DialogTarget {
  mode: "create" | "edit";
  task?: TaskView;
  day: string;
  startMinutes: number;
  endMinutes: number;
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function TaskDialog({
  target,
  modules,
  onClose,
}: {
  target: DialogTarget;
  modules: ModuleView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const task = target.task;
  const judged = task ? task.status === "COMPLETED" || task.status === "FAILED" : false;

  const [moduleId, setModuleId] = useState(task?.moduleId ?? modules[0]?.id ?? "");
  const [day, setDay] = useState(target.day);
  const [start, setStart] = useState(clockFromMinutes(target.startMinutes));
  const [end, setEnd] = useState(clockFromMinutes(target.endMinutes));
  const [title, setTitle] = useState(task && task.title !== task.moduleName ? task.title : "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = modules.find((m) => m.id === moduleId);
  const startMinutes = parseClock(start);
  const parsedEnd = parseClock(end);
  // An end of 00:00 means midnight at the end of the day, not the start of it.
  const endMinutes = parsedEnd === 0 ? 1440 : parsedEnd;
  const span = startMinutes !== null && endMinutes !== null ? endMinutes - startMinutes : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (startMinutes === null || endMinutes === null) return setError("Enter times as HH:MM");
    if (endMinutes <= startMinutes) {
      return setError("The end time has to be after the start time — a task can't run past midnight");
    }
    if (!moduleId) return setError("Pick a module first");

    setLoading(true);
    const body =
      target.mode === "create"
        ? { moduleId, day, startMinutes, endMinutes, title: title || undefined, notes: notes || undefined, repeatWeeks }
        : { moduleId, day, startMinutes, endMinutes, title: title || null, notes: notes || null };
    const res = await fetch(target.mode === "create" ? "/api/tasks" : `/api/tasks/${task!.id}`, {
      method: target.mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!task) return;
    setLoading(true);
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {target.mode === "create" ? "Book a task" : "Edit task"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {modules.length === 0 ? (
            <p className="text-sm text-gray-500">
              You need a module first — create one on the Modules tab, then book it here.
            </p>
          ) : (
            <>
              <Field label="Module">
                <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={inputCls}>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {selected && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${MODULE_COLOR_META[selected.color].chip}`} />
                    <StatBadges stats={selected.stats} size="xs" />
                    <span className="text-xs text-gray-400">earns XP on completion</span>
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Day">
                  <input type="date" value={day} disabled={judged} onChange={(e) => setDay(e.target.value)} className={inputCls} />
                </Field>
                <Field label="From">
                  <input type="time" value={start} disabled={judged} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                </Field>
                <Field label="To">
                  <input type="time" value={end} disabled={judged} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                </Field>
              </div>

              {span > 0 && (
                <p className="text-xs text-gray-500 -mt-2">
                  {formatDuration(span * 60)} booked — work {formatDuration(Math.ceil(span * 60 * 0.5))} of it to
                  complete the task.
                </p>
              )}

              <Field label="Title (optional)">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selected?.name ?? "Defaults to the module name"}
                  className={inputCls}
                />
              </Field>

              <Field label="Notes (optional)">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
              </Field>

              {target.mode === "create" && (
                <Field label="Repeat weekly">
                  <select value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))} className={inputCls}>
                    <option value={1}>Just this day</option>
                    <option value={2}>2 weeks</option>
                    <option value={4}>4 weeks</option>
                    <option value={8}>8 weeks</option>
                    <option value={12}>12 weeks</option>
                  </select>
                </Field>
              )}

              {judged && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  This task has been judged, so its slot is locked.
                </p>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {target.mode === "edit" ? (
              <button
                type="button"
                onClick={remove}
                disabled={loading}
                className="flex items-center gap-2 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || modules.length === 0}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving…" : target.mode === "create" ? "Book it" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
