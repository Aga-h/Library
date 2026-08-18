"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ui/ImageUpload";

interface IssueFormData {
  issueNumber: string;
  name: string;
  read: boolean;
  owned: boolean;
  rating: string;
  releaseDate: string;
  timesReread: string;
  coverImage: string;
  notes: string;
}

const DEFAULT: IssueFormData = {
  issueNumber: "", name: "", read: false, owned: false,
  rating: "", releaseDate: "", timesReread: "0", coverImage: "", notes: "",
};

interface Props {
  mode: "create" | "edit";
  titleId: string;
  issueId?: string;
  /** After save the router goes to `${redirectTo}/${saved.id}`. */
  redirectTo: string;
  /** Prefilled for a new issue: one past the highest existing number. */
  suggestedNumber?: string;
  initialData?: Partial<IssueFormData>;
}

export default function IssueForm({
  mode, titleId, issueId, redirectTo, suggestedNumber, initialData,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<IssueFormData>({
    ...DEFAULT,
    ...(suggestedNumber ? { issueNumber: suggestedNumber } : {}),
    ...initialData,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof IssueFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const num = parseFloat(form.issueNumber);
    if (Number.isNaN(num)) {
      setError("Issue number must be a number");
      return;
    }

    setLoading(true);
    setError(null);

    const payload =
      mode === "edit"
        ? {
            issueNumber: num,
            name: form.name || null,
            read: form.read,
            owned: form.owned,
            rating: form.rating ? parseFloat(form.rating) : null,
            releaseDate: form.releaseDate || null,
            timesReread: parseInt(form.timesReread, 10) || 0,
            coverImage: form.coverImage || null,
            notes: form.notes || null,
          }
        : {
            titleId,
            issueNumber: num,
            name: form.name || undefined,
            read: form.read,
            owned: form.owned,
            rating: form.rating ? parseFloat(form.rating) : undefined,
            releaseDate: form.releaseDate || undefined,
            timesReread: parseInt(form.timesReread, 10) || 0,
            coverImage: form.coverImage || undefined,
            notes: form.notes || undefined,
          };

    const url = mode === "edit" && issueId ? `/api/comics/issues/${issueId}` : "/api/comics/issues";
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Issue Number *">
          <input
            type="number"
            step="0.1"
            required
            autoFocus
            value={form.issueNumber}
            onChange={(e) => update("issueNumber", e.target.value)}
            placeholder="1"
            className={inputCls}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Issue Title">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. The Night Gwen Stacy Died"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.read}
            onChange={(e) => update("read", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-gray-900"
          />
          Read
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.owned}
            onChange={(e) => update("owned", e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-gray-900"
          />
          Owned
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Rating (1–10)">
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={form.rating}
            onChange={(e) => update("rating", e.target.value)}
            placeholder="e.g. 8"
            className={inputCls}
          />
        </Field>
        <Field label="Release Date">
          <input
            type="date"
            value={form.releaseDate}
            onChange={(e) => update("releaseDate", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Times reread">
          <select
            value={form.timesReread}
            onChange={(e) => update("timesReread", e.target.value)}
            className={inputCls}
          >
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Never" : `${i}×`}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Cover Image">
        <ImageUpload
          value={form.coverImage}
          onChange={(url) => update("coverImage", url)}
          fieldName="comic-issues"
        />
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
            : (mode === "edit" ? "Save Changes" : "Add Issue")}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-400";
