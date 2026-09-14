"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { formatMinute, parseHHMM, formatRange } from "@/lib/calendar-dates";

export interface ModuleRow {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number | null;
  usedInDays: number;
}

const BLANK = { title: "", start: "09:00", end: "" };

export default function ModulesManager({ modules }: { modules: ModuleRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState(BLANK);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function send(url: string, init: RequestInit) {
    setError(null);
    const res = await fetch(url, init);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  function body(v: typeof BLANK) {
    return JSON.stringify({
      title: v.title,
      startMinute: parseHHMM(v.start),
      endMinute: v.end ? parseHHMM(v.end) : null,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="flex flex-col gap-2">
        {modules.length === 0 && (
          <p className="text-sm text-gray-400">
            No modules yet. Create one below and it becomes available in every day.
          </p>
        )}
        {modules.map((m) =>
          editing === m.id ? (
            <form key={m.id}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await send(`/api/calendar/modules/${m.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" }, body: body(edit),
                })) setEditing(null);
              }}
              className="flex flex-wrap items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
              <input type="time" required value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })}
                aria-label="Start time" className={`${inputCls} w-28`} />
              <input type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })}
                aria-label="End time (optional)" className={`${inputCls} w-28`} />
              <input type="text" required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                aria-label="Event name" className={`${inputCls} flex-1 min-w-40`} />
              <button type="submit" className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">Save</button>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cancel"
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-gray-900 min-w-0">
                <span className="text-gray-400 tabular-nums">{formatRange(m.startMinute, m.endMinute)}</span>{" "}
                {m.title}
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400 mr-1">
                  {m.usedInDays === 0 ? "not placed" : `in ${m.usedInDays} ${m.usedInDays === 1 ? "day" : "days"}`}
                </span>
                <button aria-label="Edit module"
                  onClick={() => {
                    setEditing(m.id);
                    setEdit({ title: m.title, start: formatMinute(m.startMinute), end: m.endMinute != null ? formatMinute(m.endMinute) : "" });
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"><Pencil className="w-4 h-4" /></button>
                {confirming === m.id ? (
                  <button onClick={() => send(`/api/calendar/modules/${m.id}`, { method: "DELETE" })}
                    className="bg-red-600 text-white px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-red-700 transition-colors">
                    {m.usedInDays > 0 ? `Remove from ${m.usedInDays} ${m.usedInDays === 1 ? "day" : "days"}` : "Delete"}
                  </button>
                ) : (
                  <button aria-label="Delete module" onClick={() => setConfirming(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                )}
              </span>
            </div>
          )
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/calendar/modules", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: body(draft),
          })) setDraft(BLANK);
        }}
        className="flex flex-wrap items-end gap-2 border-t border-gray-200 pt-6"
      >
        <input type="time" required value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          aria-label="Start time" className={`${inputCls} w-28`} />
        <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          aria-label="End time (optional)" className={`${inputCls} w-28`} />
        <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="e.g. Sat vocab study" aria-label="Event name" className={`${inputCls} flex-1 min-w-48`} />
        <button type="submit" className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add module
        </button>
      </form>
    </div>
  );
}
