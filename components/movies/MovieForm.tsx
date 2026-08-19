"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";

interface MovieFormData {
  title: string;
  universeId: string;
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
  universeOptions?: HierarchyOption[];
  initialData?: Partial<MovieFormData & { id: string }>;
  mode: "create" | "edit";
  directorOptions?: string[];
  studioOptions?: string[];
  yearOptions?: string[];
}

const DEFAULT_DATA: MovieFormData = {
  universeId: "",
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


export default function MovieForm({ universeOptions, initialData, mode, directorOptions, studioOptions, yearOptions }: MovieFormProps) {
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

    // undefined is dropped by JSON.stringify, so on edit a cleared field would silently keep
    // its old value. null is sent explicitly; on create the key is simply omitted.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      title: form.title,
      director: form.director || clearable,
      studio: form.studio || clearable,
      universeId: form.universeId || clearable,
      status: form.status,
      runtime: parseInt(form.runtime, 10),
      year: form.year ? parseInt(form.year, 10) : clearable,
      language: form.language,
      coverImage: form.coverImage || clearable,
      rating: form.rating ? parseFloat(form.rating) : clearable,
      notes: form.notes || clearable,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HierarchySelect
          label="Universe"
          value={form.universeId}
          onChange={(v) => update("universeId", v)}
          options={universeOptions ?? []}
        />
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
        <FieldGroup label="Cover Image URL">
          <ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="movies" />
        </FieldGroup>
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

