"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputCls } from "@/components/ui/form";
import ComboboxField from "@/components/ui/ComboboxField";
import { CATEGORY_MAX, NAME_MAX, NOTE_MAX, nameFromUrl, normaliseShopUrl } from "@/lib/shopping";

export interface ShopFormData {
  url: string;
  name: string;
  category: string;
  liked: string;
  disliked: string;
}

interface Props {
  mode: "create" | "edit";
  /** Every category to offer: the ones in use, then the suggestions. */
  categories: string[];
  initialData?: Partial<ShopFormData> & { id?: string };
}

export default function ShopForm({ mode, categories, initialData }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ShopFormData>({
    url: "", name: "", category: "", liked: "", disliked: "", ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof ShopFormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Typing an address fills in a name to start from — only while the name is still empty.
  function suggestName() {
    if (form.name.trim()) return;
    const href = normaliseShopUrl(form.url);
    if (href) update("name", nameFromUrl(href));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normaliseShopUrl(form.url)) {
      setError("That doesn't look like a web address — try something like zara.com");
      return;
    }
    setSaving(true);
    setError(null);
    // Notes are sent even when empty, so clearing one on edit clears it.
    const payload = { url: form.url, name: form.name, category: form.category, liked: form.liked, disliked: form.disliked };
    const res = await fetch(mode === "edit" ? `/api/shopping/${initialData?.id}` : "/api/shopping", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setSaving(false);
      return;
    }
    router.push("/shopping");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Website *">
          <input type="text" inputMode="url" autoComplete="url" required value={form.url}
            onChange={(e) => update("url", e.target.value)} onBlur={suggestName}
            placeholder="e.g. zara.com" className={inputCls} />
        </Field>
        <Field label="Name *">
          <input type="text" required maxLength={NAME_MAX} value={form.name}
            onChange={(e) => update("name", e.target.value)} placeholder="Filled in from the website" className={inputCls} />
        </Field>
      </div>

      <ComboboxField label="Category *" required value={form.category} onChange={(v) => update("category", v.slice(0, CATEGORY_MAX))}
        options={categories} placeholder="e.g. Clothing — or type a new one" />

      <Field label="What I liked">
        <textarea rows={4} maxLength={NOTE_MAX} value={form.liked} onChange={(e) => update("liked", e.target.value)}
          placeholder="Fast delivery, good quality, easy returns…" className={inputCls} />
      </Field>
      <Field label="What I didn't like">
        <textarea rows={4} maxLength={NOTE_MAX} value={form.disliked} onChange={(e) => update("disliked", e.target.value)}
          placeholder="Sizes run small, slow support…" className={inputCls} />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add shop"}
        </button>
      </div>
    </form>
  );
}
