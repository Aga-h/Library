"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { calculateReadingTime } from "@/lib/reading-time";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import { deriveStatus, bookProgress, BOOK_STATUS } from "@/lib/derive-status";
import DerivedStatus from "@/components/ui/DerivedStatus";
import SeriesSelect, { type SeriesOption } from "@/components/ui/SeriesSelect";

interface BookFormData {
  title: string;
  seriesId: string;
  author: string;
  owned: boolean;
  language: string;
  publisher: string;
  pages: string;
  pagesRead: string;
  coverImage: string;
  rating: string;
  notes: string;
  timesReread: string;
}

interface BookFormProps {
  seriesOptions?: SeriesOption[];
  initialData?: Partial<BookFormData & { id: string }>;
  mode: "create" | "edit";
  authorOptions?: string[];
  publisherOptions?: string[];
}

const DEFAULT_DATA: BookFormData = {
  seriesId: "",
  pagesRead: "0",
  title: "",
  author: "",
  owned: false,
  language: "ENGLISH",
  publisher: "",
  pages: "",
  coverImage: "",
  rating: "",
  notes: "",
  timesReread: "0",
};

const STATUS_LABELS: Record<string, string> = {"WANT_TO_READ": "Plan to Read", "READING": "Reading", "READ": "Read", "PLAN_TO_WATCH": "Plan to Watch", "WATCHING": "Watching", "COMPLETED": "Completed", "PLAN_TO_READ": "Plan to Read"};

export default function BookForm({ seriesOptions, initialData, mode, authorOptions, publisherOptions }: BookFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<BookFormData>({
    ...DEFAULT_DATA,
    ...initialData,
    pages: initialData?.pages?.toString() ?? "",
    pagesRead: initialData?.pagesRead?.toString() ?? "0",
    rating: initialData?.rating?.toString() ?? "",
    timesReread: initialData?.timesReread?.toString() ?? "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = parseInt(form.pages, 10);
  const previewTime =
    !isNaN(pages) && pages > 0
      ? calculateReadingTime(pages, form.language as never)
      : null;

  function update(key: keyof BookFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Status is computed, not chosen — see lib/derive-status.ts
  const derivedStatus = deriveStatus(bookProgress({ pagesRead: parseInt(form.pagesRead, 10) || 0, pages: parseInt(form.pages, 10) || 0 }), BOOK_STATUS);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // undefined is dropped by JSON.stringify, so on edit a cleared field would silently keep
    // its old value. null is sent explicitly; on create the key is simply omitted.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      title: form.title,
      author: form.author,
      owned: form.owned,
      language: form.language,
      publisher: form.publisher || clearable,
      seriesId: form.seriesId || clearable,
      pages: parseInt(form.pages, 10),
    pagesRead: parseInt(form.pagesRead, 10) || 0,
      coverImage: form.coverImage || clearable,
      rating: form.rating ? parseFloat(form.rating) : clearable,
      notes: form.notes || clearable,
      timesReread: parseInt(form.timesReread, 10) || 0,
    };

    const url =
      mode === "edit" && initialData?.id
        ? `/api/books/${initialData.id}`
        : "/api/books";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const book = await res.json();
    router.push(`/library/books/${book.id}`);

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Title & Author */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Book title"
            className={inputCls}
          />
        </Field>
        <ComboboxField
          label="Author *"
          value={form.author}
          onChange={v => update("author", v)}
          options={authorOptions ?? []}
          placeholder="Author name"
          required
        />
      </div>

      {/* Status & Language */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Language">
          <select
            value={form.language}
            onChange={(e) => update("language", e.target.value)}
            className={inputCls}
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Pages & Publisher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Number of Pages *">
          <input
            type="number"
            required
            min={1}
            value={form.pages}
            onChange={(e) => update("pages", e.target.value)}
            placeholder="e.g. 320"
            className={inputCls}
          />
          {previewTime && (
            <p className="text-xs text-gray-400 mt-1.5">
              Estimated reading time: <strong className="text-gray-600">{previewTime.formatted}</strong>
            </p>
          )}
        </Field>
        <Field label="Pages Read">
          <input
            type="number"
            min={0}
            value={form.pagesRead}
            onChange={(e) => update("pagesRead", e.target.value)}
            placeholder="0"
            className={inputCls}
          />
          <DerivedStatus label={STATUS_LABELS[derivedStatus] ?? derivedStatus} />
        </Field>
        <ComboboxField
          label="Publisher"
          value={form.publisher}
          onChange={v => update("publisher", v)}
          options={publisherOptions ?? []}
          placeholder="e.g. Penguin Books"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SeriesSelect
          value={form.seriesId}
          onChange={(v) => update("seriesId", v)}
          options={seriesOptions ?? []}
        />
      </div>

      {/* Cover Image & Rating */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Cover Image URL">
          <ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="books" />
        </FieldGroup>
        <Field label="Rating (1–10)">
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={form.rating}
            onChange={(e) => update("rating", e.target.value)}
            placeholder="e.g. 8.5"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Times Reread */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Times reread">
          <select value={form.timesReread} onChange={(e) => update("timesReread", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Owned checkbox */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.owned}
          onChange={(e) => update("owned", e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
        />
        <span className="text-sm text-gray-700">I own a physical copy</span>
      </label>

      {/* Notes */}
      <Field label="Notes">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Any personal notes, reviews, thoughts..."
          className={inputCls}
        />
      </Field>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading
            ? mode === "edit"
              ? "Saving…"
              : "Adding…"
            : mode === "edit"
            ? "Save Changes"
            : "Add Book"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}


