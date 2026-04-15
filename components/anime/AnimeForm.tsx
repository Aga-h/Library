"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { formatReadingTime } from "@/lib/reading-time";

interface AnimeFormData {
  title: string; studio: string; status: string;
  episodes: string; episodesWatched: string; episodeDuration: string;
  season: string; year: string; language: string;
  coverImage: string; rating: string; notes: string;
}

const DEFAULT: AnimeFormData = {
  title: "", studio: "", status: "PLAN_TO_WATCH",
  episodes: "", episodesWatched: "0", episodeDuration: "24",
  season: "", year: "", language: "JAPANESE",
  coverImage: "", rating: "", notes: "",
};

interface Props { initialData?: Partial<AnimeFormData & { id: string }>; mode: "create" | "edit"; }

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function AnimeForm({ initialData, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<AnimeFormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watched = parseInt(form.episodesWatched, 10) || 0;
  const duration = parseInt(form.episodeDuration, 10) || 24;
  const previewMinutes = watched * duration;

  function update(key: keyof AnimeFormData, value: string) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = {
      title: form.title, studio: form.studio || undefined, status: form.status,
      episodes: form.episodes ? parseInt(form.episodes, 10) : undefined,
      episodesWatched: parseInt(form.episodesWatched, 10) || 0,
      episodeDuration: parseInt(form.episodeDuration, 10) || 24,
      season: form.season || undefined, year: form.year ? parseInt(form.year, 10) : undefined,
      language: form.language, coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined, notes: form.notes || undefined,
    };
    const url = mode === "edit" && initialData?.id ? `/api/anime/${initialData.id}` : "/api/anime";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/library/anime/${item.id}`); 
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Anime title" className={inputCls} /></Field>
        <Field label="Studio"><input type="text" value={form.studio} onChange={(e) => update("studio", e.target.value)} placeholder="e.g. MAPPA" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Status">
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputCls}>
            <option value="PLAN_TO_WATCH">Plan to Watch</option>
            <option value="WATCHING">Watching</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </Field>
        <Field label="Language">
          <select value={form.language} onChange={(e) => update("language", e.target.value)} className={inputCls}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Total Episodes"><input type="number" min={1} value={form.episodes} onChange={(e) => update("episodes", e.target.value)} placeholder="e.g. 24" className={inputCls} /></Field>
        <Field label="Episodes Watched">
          <input type="number" min={0} value={form.episodesWatched} onChange={(e) => update("episodesWatched", e.target.value)} placeholder="0" className={inputCls} />
          {previewMinutes > 0 && <p className="text-xs text-gray-400 mt-1.5">Time watched: <strong className="text-gray-600">{formatReadingTime(previewMinutes)}</strong></p>}
        </Field>
        <Field label="Episode Duration (min)"><input type="number" min={1} value={form.episodeDuration} onChange={(e) => update("episodeDuration", e.target.value)} placeholder="24" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Season">
          <select value={form.season} onChange={(e) => update("season", e.target.value)} className={inputCls}>
            <option value="">Unknown</option>
            <option value="WINTER">Winter</option>
            <option value="SPRING">Spring</option>
            <option value="SUMMER">Summer</option>
            <option value="FALL">Fall</option>
          </select>
        </Field>
        <Field label="Year"><input type="number" min={1960} max={2030} value={form.year} onChange={(e) => update("year", e.target.value)} placeholder="e.g. 2023" className={inputCls} /></Field>
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 8.5" className={inputCls} /></Field>
      </div>

      <Field label="Cover Image URL"><input type="url" value={form.coverImage} onChange={(e) => update("coverImage", e.target.value)} placeholder="https://..." className={inputCls} /></Field>
      <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Thoughts, reviews..." className={inputCls} /></Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add Anime")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}
