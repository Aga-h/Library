"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { calculateComicTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";
import ComboboxField from "@/components/ui/ComboboxField";

interface ComicFormData {
  title: string; author: string; artist: string; publisher: string; universe: string;
  status: string; totalIssues: string; issuesRead: string;
  language: string; coverImage: string; rating: string; notes: string; timesReread: string;
}

const DEFAULT: ComicFormData = {
  title: "", author: "", artist: "", publisher: "", universe: "",
  status: "PLAN_TO_READ", totalIssues: "", issuesRead: "0",
  language: "ENGLISH", coverImage: "", rating: "", notes: "", timesReread: "0",
};

interface Props {
  initialData?: Partial<ComicFormData & { id: string }>;
  mode: "create" | "edit";
  authorOptions?: string[];
  artistOptions?: string[];
  publisherOptions?: string[];
  universeOptions?: string[];
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function ComicForm({ initialData, mode, authorOptions, artistOptions, publisherOptions, universeOptions }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ComicFormData>({ ...DEFAULT, ...initialData, timesReread: initialData?.timesReread?.toString() ?? "0" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issuesRead = parseInt(form.issuesRead, 10) || 0;
  const previewTime = issuesRead > 0 ? calculateComicTime(issuesRead, form.language as LanguageKey) : null;

  function update(key: keyof ComicFormData, value: string) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = {
      title: form.title, author: form.author || undefined, artist: form.artist || undefined,
      publisher: form.publisher || undefined, universe: form.universe || undefined,
      status: form.status,
      totalIssues: form.totalIssues ? parseInt(form.totalIssues, 10) : undefined,
      issuesRead: parseInt(form.issuesRead, 10) || 0,
      language: form.language, coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined, notes: form.notes || undefined,
      timesReread: parseInt(form.timesReread, 10) || 0,
    };
    const url = mode === "edit" && initialData?.id ? `/api/comics/${initialData.id}` : "/api/comics";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/library/comics/${item.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Comic title" className={inputCls} /></Field>
        <ComboboxField label="Universe" value={form.universe} onChange={v => update("universe", v)} options={universeOptions ?? []} placeholder="e.g. Marvel, DC" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Status">
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputCls}>
            <option value="PLAN_TO_READ">Plan to Read</option>
            <option value="READING">Reading</option>
            <option value="COMPLETED">Completed</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </Field>
        <Field label="Language">
          <select value={form.language} onChange={(e) => update("language", e.target.value)} className={inputCls}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Total Issues"><input type="number" min={0} value={form.totalIssues} onChange={(e) => update("totalIssues", e.target.value)} placeholder="?" className={inputCls} /></Field>
        <Field label="Issues Read">
          <input type="number" min={0} value={form.issuesRead} onChange={(e) => update("issuesRead", e.target.value)} placeholder="0" className={inputCls} />
          {previewTime && <p className="text-xs text-gray-400 mt-1.5">Est. time: <strong className="text-gray-600">{previewTime.formatted}</strong></p>}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComboboxField label="Writer/Author" value={form.author} onChange={v => update("author", v)} options={authorOptions ?? []} placeholder="Writer name" />
        <ComboboxField label="Artist" value={form.artist} onChange={v => update("artist", v)} options={artistOptions ?? []} placeholder="Artist name (if different)" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ComboboxField label="Publisher" value={form.publisher} onChange={v => update("publisher", v)} options={publisherOptions ?? []} placeholder="e.g. Marvel Comics" />
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 8" className={inputCls} /></Field>
        <Field label="Times reread">
          <select value={form.timesReread} onChange={(e) => update("timesReread", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Cover Image URL"><input type="url" value={form.coverImage} onChange={(e) => update("coverImage", e.target.value)} placeholder="https://..." className={inputCls} /></Field>

      <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Thoughts, reviews..." className={inputCls} /></Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add Comic")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}
