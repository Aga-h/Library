"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { calculateReadingTime } from "@/lib/reading-time";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";

interface BookFormData {
  title: string;
  author: string;
  status: string;
  owned: boolean;
  language: string;
  publisher: string;
  pages: string;
  coverImage: string;
  rating: string;
  notes: string;
  timesReread: string;
}

interface BookFormProps {
  initialData?: Partial<BookFormData & { id: string }>;
  mode: "create" | "edit";
  authorOptions?: string[];
  publisherOptions?: string[];
}

const DEFAULT_DATA: BookFormData = {
  title: "",
  author: "",
  status: "WANT_TO_READ",
  owned: false,
  language: "ENGLISH",
  publisher: "",
  pages: "",
  coverImage: "",
  rating: "",
  notes: "",
  timesReread: "0",
};

export default function BookForm({ initialData, mode, authorOptions, publisherOptions }: BookFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<BookFormData>({
    ...DEFAULT_DATA,
    ...initialData,
    pages: initialData?.pages?.toString() ?? "",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title: form.title,
      author: form.author,
      status: form.status,
      owned: form.owned,
      language: form.language,
      publisher: form.publisher || undefined,
      pages: parseInt(form.pages, 10),
      coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined,
      notes: form.notes || undefined,
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
        <Field label="Reading Status">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputCls}
          >
            <option value="WANT_TO_READ">Plan to Read</option>
            <option value="READING">Reading</option>
            <option value="READ">Read</option>
            <option value="DNF">Dropped</option>
          </select>
        </Field>
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
        <ComboboxField
          label="Publisher"
          value={form.publisher}
          onChange={v => update("publisher", v)}
          options={publisherOptions ?? []}
          placeholder="e.g. Penguin Books"
        />
      </div>

      {/* Cover Image & Rating */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Cover Image URL">
          <ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="books" />
        </Field>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";
