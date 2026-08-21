"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Field, inputCls } from "@/components/ui/form";

export interface ActivityDraft {
  title: string;
  start: string;   // "HH:MM", the value an <input type="time"> gives
  end: string;
  notes: string;
}

interface Props {
  mode: "create" | "edit";
  planId?: string;
  initial?: { name: string; kind: string; notes: string; activities: ActivityDraft[] };
}

/** "09:30" → 570. The empty string means "not set". */
function toMinutes(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

const BLANK: ActivityDraft = { title: "", start: "09:00", end: "", notes: "" };

export default function DayPlanForm({ mode, planId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "HOLIDAY");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [activities, setActivities] = useState<ActivityDraft[]>(initial?.activities ?? [BLANK]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<ActivityDraft>) {
    setActivities((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Blank rows are how you delete an activity — drop them rather than failing validation.
    const rows = activities.filter((a) => a.title.trim() !== "");
    const bad = rows.find((a) => toMinutes(a.start) === null);
    if (bad) { setError(`"${bad.title}" needs a start time`); setLoading(false); return; }

    const payload = {
      name,
      ...(mode === "create" ? { kind } : {}),
      notes: notes || (mode === "edit" ? null : undefined),
      activities: rows.map((a) => ({
        title: a.title.trim(),
        startMinute: toMinutes(a.start)!,
        endMinute: a.end ? toMinutes(a.end) : null,
        notes: a.notes || null,
      })),
    };

    // Create cannot carry activities in one call (the plan has no id yet), so a new plan is
    // created and then immediately patched with its timetable.
    const res = mode === "edit"
      ? await fetch(`/api/calendar/days/${planId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })
      : await fetch("/api/calendar/days", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind, notes: notes || undefined }),
        });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Something went wrong"); setLoading(false); return; }

    if (mode === "create" && payload.activities.length > 0) {
      const patch = await fetch(`/api/calendar/days/${data.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: payload.activities }),
      });
      if (!patch.ok) {
        const pd = await patch.json().catch(() => ({}));
        setError(pd.error ?? "The day was created but its activities were not saved");
        setLoading(false);
        return;
      }
    }

    router.push("/calendar/days");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name *">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Heavy study day" className={inputCls} />
        </Field>
        <Field label="Kind *">
          <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={mode === "edit"}
            className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-500`}>
            <option value="HOLIDAY">Holiday day</option>
            <option value="SCHOOL">School day</option>
          </select>
        </Field>
      </div>
      {mode === "edit" && (
        <p className="-mt-4 text-xs text-gray-400">
          A day&apos;s kind cannot change — it would strand the dates it is already dealt onto.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Activities</span>
        {activities.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input type="time" value={a.start} onChange={(e) => update(i, { start: e.target.value })}
              aria-label="Start time" className={`${inputCls} w-28`} />
            <input type="time" value={a.end} onChange={(e) => update(i, { end: e.target.value })}
              aria-label="End time (optional)" className={`${inputCls} w-28`} />
            <input type="text" value={a.title} onChange={(e) => update(i, { title: e.target.value })}
              placeholder="What are you doing?" className={`${inputCls} flex-1 min-w-40`} />
            <button type="button" onClick={() => setActivities((p) => p.filter((_, idx) => idx !== i))}
              aria-label="Remove activity"
              className="p-2 text-gray-400 hover:text-red-600 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setActivities((p) => [...p, { ...BLANK }])}
          className="self-start flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <Plus className="w-4 h-4" /> Add activity
        </button>
      </div>

      <Field label="Notes">
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything about this kind of day…" className={inputCls} />
      </Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Day"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
