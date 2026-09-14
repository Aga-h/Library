"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field, inputCls } from "@/components/ui/form";
import { formatRange } from "@/lib/calendar-dates";

export interface ModuleOption {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number | null;
}

interface Props {
  mode: "create" | "edit";
  planId?: string;
  modules: ModuleOption[];
  initial?: { name: string; kind: string; notes: string; moduleIds: string[] };
}

export default function DayPlanForm({ mode, planId, modules, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "HOLIDAY");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.moduleIds ?? []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Shown in time order, which is how a day actually runs.
  const inOrder = [...modules].sort((a, b) => a.startMinute - b.startMinute || a.title.localeCompare(b.title));
  const chosen = inOrder.filter((m) => picked.has(m.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const moduleIds = [...picked];

    // Create cannot carry placements in one call (the plan has no id yet), so a new day is
    // created and then immediately patched with the modules placed in it.
    const res = mode === "edit"
      ? await fetch(`/api/calendar/days/${planId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, notes: notes || null, moduleIds }),
        })
      : await fetch("/api/calendar/days", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind, notes: notes || undefined }),
        });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Something went wrong"); setLoading(false); return; }

    if (mode === "create" && moduleIds.length > 0) {
      const patch = await fetch(`/api/calendar/days/${data.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleIds }),
      });
      if (!patch.ok) {
        const pd = await patch.json().catch(() => ({}));
        setError(pd.error ?? "The day was created but its modules were not placed");
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
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700">
            Modules in this day{chosen.length > 0 && ` · ${chosen.length}`}
          </span>
          <Link href="/calendar/modules" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Manage modules →
          </Link>
        </div>

        {modules.length === 0 ? (
          <p className="text-sm text-gray-400">
            No modules yet. <Link href="/calendar/modules" className="underline hover:text-gray-700">Create one</Link> and
            it will be available in every day.
          </p>
        ) : (
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {inOrder.map((m) => {
              const on = picked.has(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    on ? "bg-gray-900 text-white" : "hover:bg-gray-100 text-gray-700"
                  }`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    on ? "bg-white border-white" : "border-gray-300"
                  }`}>
                    {on && <Check className="w-3 h-3 text-gray-900" />}
                  </span>
                  <span className={`text-xs tabular-nums flex-shrink-0 ${on ? "text-gray-300" : "text-gray-400"}`}>
                    {formatRange(m.startMinute, m.endMinute)}
                  </span>
                  <span className="text-sm">{m.title}</span>
                </button>
              );
            })}
          </div>
        )}
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
