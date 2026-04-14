"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_GROUPS, PLATFORM_LABELS } from "@/lib/constants/platforms";

interface GameFormData {
  title: string; developer: string; publisher: string; status: string;
  platform: string; emulated: boolean; hoursPlayed: string;
  achievementsUnlocked: string; achievementsTotal: string;
  coverImage: string; rating: string; notes: string;
}

const DEFAULT: GameFormData = {
  title: "", developer: "", publisher: "", status: "PLAN_TO_PLAY",
  platform: "PC", emulated: false, hoursPlayed: "0",
  achievementsUnlocked: "0", achievementsTotal: "",
  coverImage: "", rating: "", notes: "",
};

interface Props { initialData?: Partial<GameFormData & { id: string }>; mode: "create" | "edit"; }
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function GameForm({ initialData, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<GameFormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof GameFormData, value: string | boolean) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = {
      title: form.title, developer: form.developer || undefined,
      publisher: form.publisher || undefined, status: form.status,
      platform: form.platform, emulated: form.emulated,
      hoursPlayed: parseFloat(form.hoursPlayed) || 0,
      achievementsUnlocked: parseInt(form.achievementsUnlocked, 10) || 0,
      achievementsTotal: form.achievementsTotal ? parseInt(form.achievementsTotal, 10) : undefined,
      coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined,
      notes: form.notes || undefined,
    };
    const url = mode === "edit" && initialData?.id ? `/api/games/${initialData.id}` : "/api/games";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/games/${item.id}`); router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Game title" className={inputCls} /></Field>
        <Field label="Developer"><input type="text" value={form.developer} onChange={(e) => update("developer", e.target.value)} placeholder="e.g. FromSoftware" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Status">
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputCls}>
            <option value="PLAN_TO_PLAY">Plan to Play</option>
            <option value="PLAYING">Playing</option>
            <option value="COMPLETED">Completed</option>
            <option value="PLATINUM">Platinum / 100%</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </Field>
        <Field label="Platform">
          <select value={form.platform} onChange={(e) => update("platform", e.target.value)} className={inputCls}>
            {PLATFORM_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Hours Played"><input type="number" min={0} step={0.5} value={form.hoursPlayed} onChange={(e) => update("hoursPlayed", e.target.value)} placeholder="0" className={inputCls} /></Field>
        <Field label="Achievements Unlocked"><input type="number" min={0} value={form.achievementsUnlocked} onChange={(e) => update("achievementsUnlocked", e.target.value)} placeholder="0" className={inputCls} /></Field>
        <Field label="Achievements Total"><input type="number" min={0} value={form.achievementsTotal} onChange={(e) => update("achievementsTotal", e.target.value)} placeholder="e.g. 50" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Publisher"><input type="text" value={form.publisher} onChange={(e) => update("publisher", e.target.value)} placeholder="e.g. Bandai Namco" className={inputCls} /></Field>
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 9" className={inputCls} /></Field>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={form.emulated} onChange={(e) => update("emulated", e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
        <span className="text-sm text-gray-700">This is an emulated version</span>
      </label>

      <Field label="Cover Image URL"><input type="url" value={form.coverImage} onChange={(e) => update("coverImage", e.target.value)} placeholder="https://..." className={inputCls} /></Field>
      <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Thoughts, playthroughs..." className={inputCls} /></Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add Game")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}
