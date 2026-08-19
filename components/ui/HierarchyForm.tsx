"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";

interface FormData {
  name: string;
  coverImage: string;
  notes: string;
}

interface Props {
  mode: "create" | "edit";
  /** e.g. "/api/tv/universes" */
  apiBase: string;
  /** Present in edit mode. */
  entityId?: string;
  /** Extra fields merged into the create payload, e.g. { universeId }. */
  extraPayload?: Record<string, string>;
  /** After save the router goes to `${redirectTo}/${saved.id}`. */
  redirectTo: string;
  /** "Universe" | "Series" — used in the submit button label. */
  entityLabel: string;
  /** Supabase storage folder. Omit entirely for levels that carry no artwork. */
  imageFolder?: string;
  namePlaceholder?: string;
  initialData?: Partial<FormData>;
}

const DEFAULT: FormData = { name: "", coverImage: "", notes: "" };

export default function HierarchyForm({
  mode, apiBase, entityId, extraPayload, redirectTo, entityLabel, imageFolder,
  namePlaceholder, initialData,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCover = imageFolder !== undefined;

  function update(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Edit sends null (not undefined) for cleared fields so they can actually be blanked.
    const payload =
      mode === "edit"
        ? {
            name: form.name,
            ...(hasCover ? { coverImage: form.coverImage || null } : {}),
            notes: form.notes || null,
          }
        : {
            ...extraPayload,
            name: form.name,
            ...(hasCover ? { coverImage: form.coverImage || undefined } : {}),
            notes: form.notes || undefined,
          };

    const url = mode === "edit" && entityId ? `${apiBase}/${entityId}` : apiBase;
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

      <Field label="Name *">
        <input
          type="text"
          required
          autoFocus
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={namePlaceholder}
          className={inputCls}
        />
      </Field>

      {hasCover && (
        <FieldGroup label="Cover Image">
          <ImageUpload
            value={form.coverImage}
            onChange={(url) => update("coverImage", url)}
            fieldName={imageFolder}
          />
        </FieldGroup>
      )}

      <Field label="Notes">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Thoughts, context…"
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
            : (mode === "edit" ? "Save Changes" : `Add ${entityLabel}`)}
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
