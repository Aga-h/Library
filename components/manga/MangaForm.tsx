"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { calculateMangaTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import { deriveStatus, mangaProgress, READ_STATUS } from "@/lib/derive-status";
import DerivedStatus from "@/components/ui/DerivedStatus";

interface MangaFormData {
  title: string; author: string; artist: string; publisher: string;
  format: string; ongoing: boolean; totalVolumes: string; volumesRead: string; totalChapters: string; chaptersRead: string;
  language: string; coverImage: string; rating: string; notes: string; timesReread: string;
}

const DEFAULT: MangaFormData = {
  title: "", author: "", artist: "", publisher: "", format: "MANGA", ongoing: false, totalVolumes: "", volumesRead: "0", totalChapters: "", chaptersRead: "0",
  language: "JAPANESE", coverImage: "", rating: "", notes: "", timesReread: "0",
};

interface Props {
  initialData?: Partial<MangaFormData & { id: string }>;
  mode: "create" | "edit";
  authorOptions?: string[];
  artistOptions?: string[];
  publisherOptions?: string[];
}


const STATUS_LABELS: Record<string, string> = {"WANT_TO_READ": "Plan to Read", "READING": "Reading", "READ": "Read", "PLAN_TO_WATCH": "Plan to Watch", "WATCHING": "Watching", "COMPLETED": "Completed", "PLAN_TO_READ": "Plan to Read"};

export default function MangaForm({ initialData, mode, authorOptions, artistOptions, publisherOptions }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<MangaFormData>({ ...DEFAULT, ...initialData, timesReread: initialData?.timesReread?.toString() ?? "0" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chaptersRead = parseInt(form.chaptersRead, 10) || 0;
  const previewTime = chaptersRead > 0 ? calculateMangaTime(chaptersRead, form.language as LanguageKey) : null;

  function update(key: keyof MangaFormData, value: string | boolean) { setForm((p) => ({ ...p, [key]: value })); }

  // Status is computed, not chosen — see lib/derive-status.ts
  const derivedStatus = deriveStatus(mangaProgress({ chaptersRead: parseInt(form.chaptersRead, 10) || 0, totalChapters: form.totalChapters ? parseInt(form.totalChapters, 10) : null, volumesRead: parseInt(form.volumesRead, 10) || 0, totalVolumes: form.totalVolumes ? parseInt(form.totalVolumes, 10) : null, ongoing: form.ongoing }), READ_STATUS);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    // undefined is dropped by JSON.stringify, so on edit a cleared field would silently keep
    // its old value. null is sent explicitly; on create the key is simply omitted.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      title: form.title, author: form.author, artist: form.artist || clearable,
      publisher: form.publisher || clearable, format: form.format,
      totalVolumes: form.totalVolumes ? parseInt(form.totalVolumes, 10) : clearable,
      volumesRead: parseInt(form.volumesRead, 10) || 0,
      totalChapters: form.totalChapters ? parseInt(form.totalChapters, 10) : clearable,
      chaptersRead: parseInt(form.chaptersRead, 10) || 0,
      ongoing: form.ongoing,
      language: form.language, coverImage: form.coverImage || clearable,
      rating: form.rating ? parseFloat(form.rating) : clearable, notes: form.notes || clearable,
      timesReread: parseInt(form.timesReread, 10) || 0,
    };
    const url = mode === "edit" && initialData?.id ? `/api/manga/${initialData.id}` : "/api/manga";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/library/manga/${item.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Manga title" className={inputCls} /></Field>
        <ComboboxField label="Author *" value={form.author} onChange={v => update("author", v)} options={authorOptions ?? []} placeholder="Author name" required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Format">
          <select value={form.format} onChange={(e) => update("format", e.target.value)} className={inputCls}>
            <option value="MANGA">Manga</option>
            <option value="MANHWA">Manhwa</option>
            <option value="MANHUA">Manhua</option>
          </select>
        </Field>
        <Field label="Language">
          <select value={form.language} onChange={(e) => update("language", e.target.value)} className={inputCls}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.ongoing}
          onChange={(e) => {
            update("ongoing", e.target.checked);
            // A still-releasing series has no final count, so clear any stale totals.
            if (e.target.checked) { update("totalVolumes", ""); update("totalChapters", ""); }
          }}
          className="w-4 h-4 rounded border-gray-300 accent-gray-900"
        />
        Still releasing
        <span className="font-normal text-gray-400">— no final volume or chapter count yet</span>
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Total Volumes"><input type="number" min={0} value={form.totalVolumes} onChange={(e) => update("totalVolumes", e.target.value)}
            disabled={form.ongoing} placeholder="?" className={inputCls} /></Field>
        <Field label="Volumes Read"><input type="number" min={0} value={form.volumesRead} onChange={(e) => update("volumesRead", e.target.value)} placeholder="0" className={inputCls} /></Field>
        <Field label="Total Chapters"><input type="number" min={0} value={form.totalChapters} onChange={(e) => update("totalChapters", e.target.value)}
            disabled={form.ongoing} placeholder="?" className={inputCls} /></Field>
        <Field label="Chapters Read">
          <input type="number" min={0} value={form.chaptersRead} onChange={(e) => update("chaptersRead", e.target.value)} placeholder="0" className={inputCls} />
          <DerivedStatus label={STATUS_LABELS[derivedStatus] ?? derivedStatus} />
          {previewTime && <p className="text-xs text-gray-400 mt-1.5">Est. time: <strong className="text-gray-600">{previewTime.formatted}</strong></p>}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComboboxField label="Artist" value={form.artist} onChange={v => update("artist", v)} options={artistOptions ?? []} placeholder="Artist name (if different)" />
        <ComboboxField label="Publisher" value={form.publisher} onChange={v => update("publisher", v)} options={publisherOptions ?? []} placeholder="e.g. Shueisha" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup label="Cover Image URL"><ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="manga" /></FieldGroup>
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 9" className={inputCls} /></Field>
        <Field label="Times reread">
          <select value={form.timesReread} onChange={(e) => update("timesReread", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Thoughts, reviews..." className={inputCls} /></Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add Manga")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

