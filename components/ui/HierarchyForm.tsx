"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ui/ImageUpload";
import { Field, FieldGroup, inputCls } from "@/components/ui/form";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";

interface FormData {
  name: string;
  coverImage: string;
  notes: string;
  /** Id of the level above. "" means standalone. Only used when `parentOptions` is given. */
  parentId: string;
}

interface Props {
  mode: "create" | "edit";
  /** e.g. "/api/tv/universes" */
  apiBase: string;
  /** Present in edit mode. */
  entityId?: string;
  /**
   * Extra fields merged into the create payload, e.g. { universeId }. Create-only by design:
   * a page that sets the parent implicitly ("Add Series — In Middle-earth") has no picker.
   * Do not combine with `parentOptions` for the same key — the picker would overwrite it.
   */
  extraPayload?: Record<string, string>;
  /**
   * Supplying these turns on a parent picker, which is what lets an *edit* reparent the
   * entity — the one thing `extraPayload` cannot do. Omit for levels with nothing above them.
   */
  parentOptions?: HierarchyOption[];
  /** Label over the picker, e.g. "Universe". */
  parentLabel?: string;
  /** Payload key the picker writes to. */
  parentKey?: string;
  /** After save the router goes to `${redirectTo}/${saved.id}`. */
  redirectTo: string;
  /** "Universe" | "Series" — used in the submit button label. */
  entityLabel: string;
  /** Supabase storage folder. Omit entirely for levels that carry no artwork. */
  imageFolder?: string;
  namePlaceholder?: string;
  initialData?: Partial<FormData>;
}

const DEFAULT: FormData = { name: "", coverImage: "", notes: "", parentId: "" };

export default function HierarchyForm({
  mode, apiBase, entityId, extraPayload, redirectTo, entityLabel, imageFolder,
  namePlaceholder, initialData,
  parentOptions, parentLabel = "Universe", parentKey = "universeId",
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...DEFAULT, ...initialData });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCover = imageFolder !== undefined;
  const hasParent = parentOptions !== undefined;

  function update(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Edit sends null (not undefined) for cleared fields so they can actually be blanked;
    // undefined is dropped by JSON.stringify, so a create simply omits the key.
    const clearable = mode === "edit" ? null : undefined;

    const payload = {
      ...(mode === "edit" ? {} : extraPayload),
      name: form.name,
      ...(hasCover ? { coverImage: form.coverImage || clearable } : {}),
      notes: form.notes || clearable,
      ...(hasParent ? { [parentKey]: form.parentId || clearable } : {}),
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

      {hasParent && (
        <HierarchySelect
          label={parentLabel}
          value={form.parentId}
          onChange={(v) => update("parentId", v)}
          options={parentOptions}
        />
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
