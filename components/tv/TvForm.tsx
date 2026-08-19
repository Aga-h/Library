"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import { formatReadingTime } from "@/lib/reading-time";
import ComboboxField from "@/components/ui/ComboboxField";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import { deriveStatus, tvProgress, WATCH_STATUS } from "@/lib/derive-status";
import DerivedStatus from "@/components/ui/DerivedStatus";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";

interface TvFormData {
  title: string;
  seriesId: string;
  creator: string;
  network: string;
  totalEpisodes: string;
  episodesWatched: string;
  episodeRuntime: string;
  year: string;
  language: string;
  coverImage: string;
  rating: string;
  notes: string;
  timesRewatched: string;
}

interface TvFormProps {
  seriesOptions?: HierarchyOption[];
  initialData?: Partial<TvFormData & { id: string }>;
  mode: "create" | "edit";
  creatorOptions?: string[];
  networkOptions?: string[];
  yearOptions?: string[];
}

const DEFAULT_DATA: TvFormData = {
  seriesId: "",
  title: "",
  creator: "",
  network: "",
  totalEpisodes: "",
  episodesWatched: "0",
  episodeRuntime: "45",
  year: "",
  language: "ENGLISH",
  coverImage: "",
  rating: "",
  notes: "",
  timesRewatched: "0",
};


const STATUS_LABELS: Record<string, string> = {"WANT_TO_READ": "Plan to Read", "READING": "Reading", "READ": "Read", "PLAN_TO_WATCH": "Plan to Watch", "WATCHING": "Watching", "COMPLETED": "Completed", "PLAN_TO_READ": "Plan to Read"};

export default function TvForm({ seriesOptions, initialData, mode, creatorOptions, networkOptions, yearOptions }: TvFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TvFormData>({
    ...DEFAULT_DATA,
    ...initialData,
    totalEpisodes: initialData?.totalEpisodes?.toString() ?? "",
    episodesWatched: initialData?.episodesWatched?.toString() ?? "0",
    episodeRuntime: initialData?.episodeRuntime?.toString() ?? "45",
    year: initialData?.year?.toString() ?? "",
    rating: initialData?.rating?.toString() ?? "",
    timesRewatched: initialData?.timesRewatched?.toString() ?? "0",
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

  // Status is computed, not chosen — see lib/derive-status.ts
  const derivedStatus = deriveStatus(tvProgress({ episodesWatched: parseInt(form.episodesWatched, 10) || 0, totalEpisodes: form.totalEpisodes ? parseInt(form.totalEpisodes, 10) : null }), WATCH_STATUS);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // undefined is dropped by JSON.stringify, so on edit a cleared field would silently keep
    // its old value. null is sent explicitly; on create the key is simply omitted.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      title: form.title,
      seriesId: form.seriesId || clearable,
      creator: form.creator || clearable,
      network: form.network || clearable,
      totalEpisodes: form.totalEpisodes ? parseInt(form.totalEpisodes, 10) : clearable,
      episodesWatched: parseInt(form.episodesWatched, 10) || 0,
      episodeRuntime: parseInt(form.episodeRuntime, 10) || 45,
      year: form.year ? parseInt(form.year, 10) : clearable,
      language: form.language,
      coverImage: form.coverImage || clearable,
      rating: form.rating ? parseFloat(form.rating) : clearable,
      notes: form.notes || clearable,
      timesRewatched: parseInt(form.timesRewatched, 10) || 0,
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
    router.push(`/library/tv/${show.id}`);
    // refresh() as well as push(): without it a series or universe you just moved this
    // entry out of still lists it when you navigate back to it.
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
        <ComboboxField
          label="Creator"
          value={form.creator}
          onChange={v => update("creator", v)}
          options={creatorOptions ?? []}
          placeholder="Creator name"
        />
      </div>

      {/* Network & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComboboxField
          label="Network"
          value={form.network}
          onChange={v => update("network", v)}
          options={networkOptions ?? []}
          placeholder="e.g. HBO, Netflix"
        />
        <HierarchySelect
          value={form.seriesId}
          onChange={(v) => update("seriesId", v)}
          options={seriesOptions ?? []}
        />
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
          <DerivedStatus label={STATUS_LABELS[derivedStatus] ?? derivedStatus} />
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
          <ImageUpload value={form.coverImage} onChange={(url) => update("coverImage", url)} fieldName="tv" />
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

