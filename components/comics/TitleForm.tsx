"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_OPTIONS } from "@/lib/constants/languages";
import ComboboxField from "@/components/ui/ComboboxField";
import { Field, inputCls } from "@/components/ui/form";

interface TitleFormData {
  name: string;
  author: string;
  artist: string;
  language: string;
  notes: string;
}

const DEFAULT: TitleFormData = {
  name: "", author: "", artist: "", language: "ENGLISH", notes: "",
};

interface Props {
  mode: "create" | "edit";
  universeId: string;
  titleId?: string;
  /** After save the router goes to `${redirectTo}/${saved.id}`. */
  redirectTo: string;
  authorOptions?: string[];
  artistOptions?: string[];
  initialData?: Partial<TitleFormData>;
}

export default function TitleForm({
  mode, universeId, titleId, redirectTo, authorOptions, artistOptions, initialData,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<TitleFormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof TitleFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload =
      mode === "edit"
        ? {
            name: form.name,
            author: form.author || null,
            artist: form.artist || null,
            language: form.language,
            notes: form.notes || null,
          }
        : {
            universeId,
            name: form.name,
            author: form.author || undefined,
            artist: form.artist || undefined,
            language: form.language,
            notes: form.notes || undefined,
          };

    const url = mode === "edit" && titleId ? `/api/comics/titles/${titleId}` : "/api/comics/titles";
    const res = await fetch(url, {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const saved = await res.json();
    router.push(`${redirectTo}/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Field label="Comic Title *">
        <input
          type="text"
          required
          autoFocus
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. The Amazing Spider-Man"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ComboboxField
          label="Writer/Author"
          value={form.author}
          onChange={(v) => update("author", v)}
          options={authorOptions ?? []}
          placeholder="Writer name"
        />
        <ComboboxField
          label="Artist"
          value={form.artist}
          onChange={(v) => update("artist", v)}
          options={artistOptions ?? []}
          placeholder="Artist name (if different)"
        />
      </div>

      <Field label="Language">
        <select
          value={form.language}
          onChange={(e) => update("language", e.target.value)}
          className={inputCls}
        >
          {LANGUAGE_OPTIONS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </Field>


      <Field label="Notes">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Thoughts, reviews…"
          className={inputCls}
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading
            ? (mode === "edit" ? "Saving…" : "Adding…")
            : (mode === "edit" ? "Save Changes" : "Add Comic")}
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


