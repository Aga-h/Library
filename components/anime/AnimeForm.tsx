"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { formatReadingTime } from "@/lib/reading-time";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import { deriveStatus, animeProgress, WATCH_STATUS } from "@/lib/derive-status";
import DerivedStatus from "@/components/ui/DerivedStatus";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";

interface AnimeFormData {
  title: string;
  seriesId: string; studio: string;
  episodes: string; episodesWatched: string; episodeDuration: string;
  season: string; year: string; language: string;
  coverImage: string; rating: string; notes: string;
  timesRewatched: string;
}

const DEFAULT: AnimeFormData = {
  title: "", seriesId: "", studio: "", episodes: "", episodesWatched: "0", episodeDuration: "24",
  season: "", year: "", language: "JAPANESE",
  coverImage: "", rating: "", notes: "",
  timesRewatched: "0",
};

interface Props {
  seriesOptions?: HierarchyOption[];
  initialData?: Partial<AnimeFormData & { id: string }>;
  mode: "create" | "edit";
  studioOptions?: string[];
  yearOptions?: string[];
}


const STATUS_LABELS: Record<string, string> = {"WANT_TO_READ": "Plan to Read", "READING": "Reading", "READ": "Read", "PLAN_TO_WATCH": "Plan to Watch", "WATCHING": "Watching", "COMPLETED": "Completed", "PLAN_TO_READ": "Plan to Read"};

export default function AnimeForm({ seriesOptions, initialData, mode, studioOptions, yearOptions }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<AnimeFormData>({ ...DEFAULT, ...initialData, timesRewatched: initialData?.timesRewatched?.toString() ?? "0" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watched = parseInt(form.episodesWatched, 10) || 0;
  const duration = parseInt(form.episodeDuration, 10) || 24;
  const previewMinutes = watched * duration;

  function update(key: keyof AnimeFormData, value: string) { setForm((p) => ({ ...p, [key]: value })); }

  // Status is computed, not chosen — see lib/derive-status.ts
  const derivedStatus = deriveStatus(animeProgress({ episodesWatched: parseInt(form.episodesWatched, 10) || 0, episodes: form.episodes ? parseInt(form.episodes, 10) : null }), WATCH_STATUS);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    // undefined is dropped by JSON.stringify, so on edit a cleared field would silently keep
    // its old value. null is sent explicitly; on create the key is simply omitted.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      title: form.title, studio: form.studio || clearable,
      seriesId: form.seriesId || clearable,
      episodes: form.episodes ? parseInt(form.episodes, 10) : clearable,
      episodesWatched: parseInt(form.episodesWatched, 10) || 0,
      episodeDuration: parseInt(form.episodeDuration, 10) || 24,
      season: form.season || clearable, year: form.year ? parseInt(form.year, 10) : clearable,
      language: form.language, coverImage: form.coverImage || clearable,
      rating: form.rating ? parseFloat(form.rating) : clearable, notes: form.notes || clearable,
      timesRewatched: parseInt(form.timesRewatched, 10) || 0,
    };
    const url = mode === "edit" && initialData?.id ? `/api/anime/${initialData.id}` : "/api/anime";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/library/anime/${item.id}`);
    // refresh() as well as push(): without it a series or universe you just moved this
    // entry out of still lists it when you navigate back to it.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Anime title" className={inputCls} /></Field>
        <ComboboxField label="Studio" value={form.studio} onChange={v => update("studio", v)} options={studioOptions ?? []} placeholder="e.g. MAPPA" />
        <HierarchySelect value={form.seriesId} onChange={(v) => update("seriesId", v)} options={seriesOptions ?? []} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <DerivedStatus label={STATUS_LABELS[derivedStatus] ?? derivedStatus} />
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
        <ComboboxField label="Year" value={form.year} onChange={v => update("year", v)} options={yearOptions ?? []} placeholder="e.g. 2023" />
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 8.5" className={inputCls} /></Field>
      </div>

      <FieldGroup label="Cover Image URL"><ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="anime" /></FieldGroup>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Times rewatched">
          <select value={form.timesRewatched} onChange={(e) => update("timesRewatched", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

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

