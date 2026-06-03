"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";

interface MovieFormData {
  title: string;
  director: string;
  studio: string;
  status: string;
  runtime: string;
  year: string;
  language: string;
  coverImage: string;
  rating: string;
  notes: string;
  timesRewatched: string;
}

interface MovieFormProps {
  initialData?: Partial<MovieFormData & { id: string }>;
  mode: "create" | "edit";
  directorOptions?: string[];
  studioOptions?: string[];
  yearOptions?: string[];
}

const DEFAULT_DATA: MovieFormData = {
  title: "",
  director: "",
  studio: "",
  status: "WANT_TO_WATCH",
  runtime: "",
  year: "",
  language: "ENGLISH",
  coverImage: "",
  rating: "",
  notes: "",
  timesRewatched: "0",
};

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function MovieForm({ initialData, mode, directorOptions, studioOptions, yearOptions }: MovieFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<MovieFormData>({
    ...DEFAULT_DATA,
    ...initialData,
    runtime: initialData?.runtime?.toString() ?? "",
    year: initialData?.year?.toString() ?? "",
    rating: initialData?.rating?.toString() ?? "",
    timesRewatched: initialData?.timesRewatched?.toString() ?? "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runtimeMinutes = parseInt(form.runtime, 10);
  const previewRuntime =
    !isNaN(runtimeMinutes) && runtimeMinutes > 0
      ? formatRuntime(runtimeMinutes)
      : null;

  function update(key: keyof MovieFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title: form.title,
      director: form.director || undefined,
      studio: form.studio || undefined,
      status: form.status,
      runtime: parseInt(form.runtime, 10),
      year: form.year ? parseInt(form.year, 10) : undefined,
      language: form.language,
      coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined,
      notes: form.notes || undefined,
      timesRewatched: parseInt(form.timesRewatched, 10) || 0,
    };

    const url =
      mode === "edit" && initialData?.id
        ? `/api/movies/${initialData.id}`
        : "/api/movies";
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

    const movie = await res.json();
    router.push(`/library/movies/${movie.id}`);

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Title & Director */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Movie title"
            className={inputCls}
          />
        </Field>
        <ComboboxField
          label="Director"
          value={form.director}
          onChange={v => update("director", v)}
          options={directorOptions ?? []}
          placeholder="Director name"
        />
      </div>

      {/* Studio & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComboboxField
          label="Studio"
          value={form.studio}
          onChange={v => update("studio", v)}
          options={studioOptions ?? []}
          placeholder="e.g. Warner Bros."
        />
        <Field label="Watch Status">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputCls}
          >
            <option value="WANT_TO_WATCH">Want to Watch</option>
            <option value="WATCHED">Watched</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </Field>
      </div>

      {/* Runtime & Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Runtime * (minutes)">
          <input
            type="number"
            required
            min={1}
            value={form.runtime}
            onChange={(e) => update("runtime", e.target.value)}
            placeholder="e.g. 135"
            className={inputCls}
          />
          {previewRuntime && (
            <p className="text-xs text-gray-400 mt-1.5">
              Duration: <strong className="text-gray-600">{previewRuntime}</strong>
            </p>
          )}
        </Field>
        <ComboboxField
          label="Year"
          value={form.year}
          onChange={v => update("year", v)}
          options={yearOptions ?? []}
          placeholder="e.g. 2024"
        />
      </div>

      {/* Language & Cover Image */}
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
        <Field label="Cover Image URL">
          <ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="movies" />
        </Field>
      </div>

      {/* Rating & Times rewatched */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <Field label="Times rewatched">
          <select value={form.timesRewatched} onChange={(e) => update("timesRewatched", e.target.value)} className={inputCls}>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

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
            : "Add Movie"}
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
