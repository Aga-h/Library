"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { calculateArticleTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface ArticleFormData {
  title: string; author: string; publication: string; url: string;
  status: string; wordCount: string; language: string;
  coverImage: string; rating: string; notes: string; timesReread: string;
}

const DEFAULT: ArticleFormData = {
  title: "", author: "", publication: "", url: "",
  status: "WANT_TO_READ", wordCount: "",
  language: "ENGLISH", coverImage: "", rating: "", notes: "", timesReread: "0",
};

interface Props { initialData?: Partial<ArticleFormData & { id: string }>; mode: "create" | "edit"; }
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function ArticleForm({ initialData, mode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ArticleFormData>({ ...DEFAULT, ...initialData, timesReread: initialData?.timesReread?.toString() ?? "0" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = parseInt(form.wordCount, 10) || 0;
  const previewTime = wordCount > 0 ? calculateArticleTime(wordCount, form.language as LanguageKey) : null;

  function update(key: keyof ArticleFormData, value: string) { setForm((p) => ({ ...p, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    const payload = {
      title: form.title, author: form.author || undefined,
      publication: form.publication || undefined, url: form.url || undefined,
      status: form.status, wordCount: parseInt(form.wordCount, 10),
      language: form.language, coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined, notes: form.notes || undefined,
      timesReread: parseInt(form.timesReread, 10) || 0,
    };
    const url = mode === "edit" && initialData?.id ? `/api/articles/${initialData.id}` : "/api/articles";
    const res = await fetch(url, { method: mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Something went wrong"); setLoading(false); return; }
    const item = await res.json();
    router.push(`/library/articles/${item.id}`); 
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *"><input type="text" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Article title" className={inputCls} /></Field>
        <Field label="Author"><input type="text" value={form.author} onChange={(e) => update("author", e.target.value)} placeholder="Author name" className={inputCls} /></Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Status">
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputCls}>
            <option value="WANT_TO_READ">Want to Read</option>
            <option value="READ">Read</option>
          </select>
        </Field>
        <Field label="Language">
          <select value={form.language} onChange={(e) => update("language", e.target.value)} className={inputCls}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Publication"><input type="text" value={form.publication} onChange={(e) => update("publication", e.target.value)} placeholder="e.g. The Atlantic" className={inputCls} /></Field>
        <Field label="Word Count *">
          <input type="number" required min={1} value={form.wordCount} onChange={(e) => update("wordCount", e.target.value)} placeholder="e.g. 2500" className={inputCls} />
          {previewTime && <p className="text-xs text-gray-400 mt-1.5">Est. read time: <strong className="text-gray-600">{previewTime.formatted}</strong></p>}
        </Field>
      </div>

      <Field label="Article URL"><input type="url" value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://..." className={inputCls} /></Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Cover Image URL"><input type="url" value={form.coverImage} onChange={(e) => update("coverImage", e.target.value)} placeholder="https://..." className={inputCls} /></Field>
        <Field label="Rating (1–10)"><input type="number" min={1} max={10} step={0.5} value={form.rating} onChange={(e) => update("rating", e.target.value)} placeholder="e.g. 8" className={inputCls} /></Field>
        <Field label="Times reread">
          <select value={form.timesReread} onChange={(e) => update("timesReread", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Thoughts, key takeaways..." className={inputCls} /></Field>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {loading ? (mode === "edit" ? "Saving…" : "Adding…") : (mode === "edit" ? "Save Changes" : "Add Article")}
        </button>
        <button type="button" onClick={() => router.back()} className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-gray-700">{label}</label>{children}</div>;
}
