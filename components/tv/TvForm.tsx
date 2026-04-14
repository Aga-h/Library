"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { formatReadingTime } from "@/lib/reading-time";

interface TvFormData {
  title: string;
  creator: string;
  network: string;
  status: string;
  totalEpisodes: string;
  episodesWatched: string;
  episodeRuntime: string;
  year: string;
  language: string;
  coverImage: string;
  rating: string;
  notes: string;
}

interface TvFormProps {
  initialData?: Partial<TvFormData & { id: string }>;
  mode: "create" | "edit";
}

const DEFAULT_DATA: TvFormData = {
  title: "",
  creator: "",
  network: "",
  status: "PLAN_TO_WATCH",
  totalEpisodes: "",
  episodesWatched: "0",
  episodeRuntime: "45",
  year: "",
  language: "ENGLISH",
  coverImage: "",
  rating: "",
  notes: "",
};

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";

export default function TvForm({ initialData, mode }: TvFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TvFormData>({
    ...DEFAULT_DATA,
    ...initialData,
    totalEpisodes: initialData?.totalEpisodes?.toString() ?? "",
    episodesWatched: initialData?.episodesWatched?.toString() ?? "0",
    episodeRuntime: initialData?.episodeRuntime?.toString() ?? "45",
    year: initialData?.year?.toString() ?? "",
    rating: initialData?.rating?.toString() ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runtimeMinutes = parseInt(form.episodeRuntime, 10);
  const episodesWatched = parseInt(form.episodesWatched, 10) || 0;
  const totalWatchedMinutes = !isNaN(runtimeMinutes) && runtimeMinutes > 0
    ? episodesWatched * runtimeMinutes
    : 0;
  const previewTime = totalWatchedMinutes > 0
    ? formatReadingTime(totalWatchedMinutes)
    : null;

  function update(key: keyof TvFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title: form.title,
      creator: form.creator || undefined,
      network: form.network || undefined,
      status: form.status,
      totalEpisodes: form.totalEpisodes ? parseInt(form.totalEpisodes, 10) : undefined,
      episodesWatched: parseInt(form.episodesWatched, 10) || 0,
      episodeRuntime: parseInt(form.episodeRuntime, 10) || 45,
      year: form.year ? parseInt(form.year, 10) : undefined,
      language: form.language,
      coverImage: form.coverImage || undefined,
      rating: form.rating ? parseFloat(form.rating) : undefined,
      notes: form.notes || undefined,
    };

    const url =
      mode === "edit" && initialData?.id
        ? `/api/tv/${initialData.id}`
        : "/api/tv";
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

    const show = await res.json();
    router.push(`/tv/${show.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Title & Creator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title *">
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Show title"
            className={inputCls}
          />
        </Field>
        <Field label="Creator">
          <input
            type="text"
            value={form.creator}
            onChange={(e) => update("creator", e.target.value)}
            placeholder="Creator name"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Network & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Network">
          <input
            type="text"
            value={form.network}
            onChange={(e) => update("network", e.target.value)}
            placeholder="e.g. HBO, Netflix"
            className={inputCls}
          />
        </Field>
        <Field label="Watch Status">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className={inputCls}
          >
            <option value="PLAN_TO_WATCH">Plan to Watch</option>
            <option value="WATCHING">Watching</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </Field>
      </div>

      {/* Total Episodes & Episodes Watched */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Total Episodes">
          <input
            type="number"
            min={1}
            value={form.totalEpisodes}
            onChange={(e) => update("totalEpisodes", e.target.value)}
            placeholder="e.g. 24"
            className={inputCls}
          />
        </Field>
        <Field label="Episodes Watched">
          <input
            type="number"
            min={0}
            value={form.episodesWatched}
            onChange={(e) => update("episodesWatched", e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Episode Runtime & Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Episode Runtime (minutes)">
          <input
            type="number"
            min={1}
            value={form.episodeRuntime}
            onChange={(e) => update("episodeRuntime", e.target.value)}
            placeholder="45"
            className={inputCls}
          />
          {previewTime && (
            <p className="text-xs text-gray-400 mt-1.5">
              Time watched: <strong className="text-gray-600">{previewTime}</strong>
            </p>
          )}
        </Field>
        <Field label="Year">
          <input
            type="number"
            min={1900}
            max={2100}
            value={form.year}
            onChange={(e) => update("year", e.target.value)}
            placeholder="e.g. 2024"
            className={inputCls}
          />
        </Field>
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
          <input
            type="url"
            value={form.coverImage}
            onChange={(e) => update("coverImage", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
      </div>

      {/* Rating */}
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
            : "Add Show"}
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
