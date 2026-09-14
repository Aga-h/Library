"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  MAX_STATS_PER_MODULE,
  MODULE_COLORS,
  MODULE_COLOR_META,
  STATS,
  STAT_META,
  type ModuleColor,
  type Stat,
} from "@/lib/stats";
import type { ModuleView } from "@/lib/tasks";
import StatBadges from "@/components/tasks/StatBadges";

export interface ModuleRow extends ModuleView {
  taskCount: number;
  completed: number;
  failed: number;
  xp: number;
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function ModuleManager({ modules }: { modules: ModuleRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ModuleRow | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const active = modules.filter((m) => !m.archived);
  const archived = modules.filter((m) => m.archived);

  async function toggleArchive(mod: ModuleRow) {
    setBusy(mod.id);
    await fetch(`/api/modules/${mod.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !mod.archived }),
    });
    router.refresh();
    setBusy(null);
  }

  async function remove(mod: ModuleRow) {
    const warning = mod.taskCount
      ? `Delete "${mod.name}"? Its ${mod.taskCount} task${mod.taskCount === 1 ? "" : "s"} and the ${mod.xp.toLocaleString()} XP they earned go with it. Archive it instead to keep the history.`
      : `Delete "${mod.name}"?`;
    if (!confirm(warning)) return;
    setBusy(mod.id);
    await fetch(`/api/modules/${mod.id}`, { method: "DELETE" });
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {active.length} module{active.length === 1 ? "" : "s"} · a module trains 1–3 stats, and every task booked
          from it pays those stats on completion.
        </p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New module
        </button>
      </div>

      {active.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <p className="font-semibold text-gray-700">No modules yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Create one — say “Maths”, trained by Intelligence and Logic — then book it on the calendar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {active.map((mod) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            busy={busy === mod.id}
            onEdit={() => setEditing(mod)}
            onArchive={() => toggleArchive(mod)}
            onDelete={() => remove(mod)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Archived</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {archived.map((mod) => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                busy={busy === mod.id}
                onEdit={() => setEditing(mod)}
                onArchive={() => toggleArchive(mod)}
                onDelete={() => remove(mod)}
              />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <ModuleDialog
          mod={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ModuleCard({
  mod,
  busy,
  onEdit,
  onArchive,
  onDelete,
}: {
  mod: ModuleRow;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const color = MODULE_COLOR_META[mod.color];
  return (
    <div className={`border rounded-xl p-4 bg-white ${mod.archived ? "border-gray-200 opacity-70" : color.soft}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color.chip}`} />
            <p className="font-semibold text-gray-900 truncate">{mod.name}</p>
          </div>
          {mod.description && <p className="text-xs text-gray-500 mt-1">{mod.description}</p>}
          <div className="mt-2">
            <StatBadges stats={mod.stats} size="xs" />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} disabled={busy} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" aria-label="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onArchive} disabled={busy} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" aria-label={mod.archived ? "Restore" : "Archive"}>
            {mod.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" aria-label="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span>{mod.taskCount} task{mod.taskCount === 1 ? "" : "s"}</span>
        <span className="text-emerald-600 font-semibold">{mod.completed} done</span>
        <span className="text-red-500 font-semibold">{mod.failed} failed</span>
        <span className="ml-auto font-semibold text-gray-700">{mod.xp.toLocaleString()} XP</span>
      </div>
    </div>
  );
}

function ModuleDialog({ mod, onClose }: { mod: ModuleRow | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(mod?.name ?? "");
  const [description, setDescription] = useState(mod?.description ?? "");
  const [color, setColor] = useState<ModuleColor>(mod?.color ?? "SLATE");
  const [stats, setStats] = useState<Stat[]>(mod?.stats ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStat(stat: Stat) {
    setStats((prev) => {
      if (prev.includes(stat)) return prev.filter((s) => s !== stat);
      if (prev.length >= MAX_STATS_PER_MODULE) return prev;
      return [...prev, stat];
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the module a name");
    if (stats.length === 0) return setError("Pick at least one stat");

    setLoading(true);
    const res = await fetch(mod ? `/api/modules/${mod.id}` : "/api/modules", {
      method: mod ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || (mod ? null : undefined),
        color,
        stats,
      }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{mod ? "Edit module" : "New module"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maths" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Colour</label>
            <div className="flex items-center gap-2">
              {MODULE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={MODULE_COLOR_META[c].label}
                  className={`w-7 h-7 rounded-full ${MODULE_COLOR_META[c].chip} transition-transform ${
                    color === c ? "ring-2 ring-offset-2 ring-gray-900 scale-105" : "hover:scale-105"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-500">Stats trained *</label>
              <span className="text-xs text-gray-400">{stats.length}/{MAX_STATS_PER_MODULE}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATS.map((stat) => {
                const meta = STAT_META[stat];
                const on = stats.includes(stat);
                const full = !on && stats.length >= MAX_STATS_PER_MODULE;
                const Icon = meta.icon;
                return (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => toggleStat(stat)}
                    disabled={full}
                    title={meta.description}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      on
                        ? `${meta.bg} ${meta.text} ${meta.border}`
                        : full
                          ? "border-gray-100 text-gray-300 cursor-not-allowed"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {loading ? "Saving…" : mod ? "Save" : "Create module"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
