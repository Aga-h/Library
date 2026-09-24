"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MAX_STATS_PER_MODULE, STATS, STAT_META, type Stat } from "@/lib/stats";
import StatBadges from "@/components/study/StatBadges";

export interface ModuleRow {
  id: string;
  title: string;
  notes: string | null;
  stats: Stat[];
  /** Sessions already studied under it — what a delete would orphan. */
  sessions: number;
}

const BLANK = { title: "", notes: "" };

export default function ModulesManager({ modules }: { modules: ModuleRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK);
  const [draftStats, setDraftStats] = useState<Stat[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState(BLANK);
  const [editStats, setEditStats] = useState<Stat[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, init);
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? d.issues?.[0]?.message ?? "Something went wrong");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  const body = (v: typeof BLANK, stats: Stat[]) =>
    JSON.stringify({ title: v.title, notes: v.notes || null, stats });

  function beginEdit(m: ModuleRow) {
    setEditing(m.id);
    setEdit({ title: m.title, notes: m.notes ?? "" });
    setEditStats(m.stats);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="flex flex-col gap-2">
        {modules.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <Layers className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No modules yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Make one below — then pick it when you start studying, and it pays its stats.
            </p>
          </div>
        )}

        {modules.map((m) =>
          editing === m.id ? (
            <form key={m.id}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await send(`/api/study/modules/${m.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" }, body: body(edit, editStats),
                })) setEditing(null);
              }}
              className="flex flex-col gap-3 bg-white border border-gray-300 rounded-xl px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  aria-label="Module name" className={`${inputCls} flex-1 min-w-40`} />
                <button type="submit" disabled={busy || editStats.length === 0}
                  className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Cancel"
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <input type="text" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                placeholder="Note (optional)" aria-label="Note" className={`${inputCls} text-sm`} />
              <StatPicker picked={editStats} onToggle={setEditStats} />
            </form>
          ) : (
            <div key={m.id} className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{m.title}</p>
                {m.notes && <p className="text-xs text-gray-500 mt-0.5">{m.notes}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {m.sessions === 0 ? "not studied yet" : `${m.sessions} session${m.sessions === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatBadges stats={m.stats} size="xs" />
                {confirming === m.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={async () => { if (await send(`/api/study/modules/${m.id}`, { method: "DELETE" })) setConfirming(null); }}
                      disabled={busy}
                      className="bg-red-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                      Delete
                    </button>
                    <button onClick={() => setConfirming(null)} aria-label="Keep it"
                      className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => beginEdit(m)} aria-label={`Edit ${m.title}`}
                      className="p-2 text-gray-400 hover:text-gray-900 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setConfirming(m.id)} aria-label={`Delete ${m.title}`}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {confirming && (
        <p className="text-xs text-gray-500 -mt-4">
          Sessions already studied under a deleted module are kept — each one carries its own copy
          of the stats it paid, so your levels and study time do not move.
        </p>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("/api/study/modules", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: body(draft, draftStats),
          })) { setDraft(BLANK); setDraftStats([]); }
        }}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">New module</h3>
        <input type="text" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="What you study — e.g. AP Physics C" aria-label="Module name" className={inputCls} />
        <input type="text" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Note (optional)" aria-label="Note" className={`${inputCls} text-sm`} />
        <StatPicker picked={draftStats} onToggle={setDraftStats} />
        <button type="submit" disabled={busy || draft.title.trim() === "" || draftStats.length === 0}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          <Plus className="w-4 h-4" /> Add module
        </button>
      </form>
    </div>
  );
}

function StatPicker({ picked, onToggle }: { picked: Stat[]; onToggle: (next: Stat[]) => void }) {
  const toggle = (stat: Stat) =>
    onToggle(
      picked.includes(stat)
        ? picked.filter((s) => s !== stat)
        : picked.length >= MAX_STATS_PER_MODULE ? picked : [...picked, stat],
    );

  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">
          Stats this trains — studying it levels them
        </span>
        <span className={`text-xs ${picked.length === 0 ? "text-red-500" : "text-gray-400"}`}>
          {picked.length}/{MAX_STATS_PER_MODULE}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {STATS.map((stat) => {
          const meta = STAT_META[stat];
          const on = picked.includes(stat);
          const full = !on && picked.length >= MAX_STATS_PER_MODULE;
          const Icon = meta.icon;
          return (
            <button key={stat} type="button" onClick={() => toggle(stat)} disabled={full}
              title={meta.description} aria-pressed={on}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                on ? `${meta.bg} ${meta.text} ${meta.border}`
                   : full ? "border-gray-100 text-gray-300 cursor-not-allowed"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{meta.label}</span>
            </button>
          );
        })}
      </div>
      {picked.length === 0 && (
        <p className="text-xs text-red-500 mt-2">Pick at least one — a module with no stats pays nothing.</p>
      )}
    </div>
  );
}
