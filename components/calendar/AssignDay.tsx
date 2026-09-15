"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, inputCls } from "@/components/ui/form";

interface Option { id: string; name: string; kind: string }

export default function AssignDay({
  date, current, options, matchingKind,
}: { date: string; current: string | null; options: Option[]; matchingKind: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function save(next: string) {
    setValue(next);
    setSaving(true);
    setError(null);
    const res = await fetch("/api/calendar/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, planId: next || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save");
      return;
    }
    startTransition(() => router.refresh());
  }

  // The matching kind is listed first, but the other is still offered — sometimes a school day
  // is genuinely the right plan for a holiday, and refusing it would be the app arguing.
  const matching = options.filter((o) => o.kind === matchingKind);
  const other = options.filter((o) => o.kind !== matchingKind);

  return (
    <div className="flex flex-col gap-1.5">
      <Field label="Day">
        <select value={value} onChange={(e) => save(e.target.value)} disabled={saving} className={inputCls}>
          <option value="">Nothing planned</option>
          {matching.length > 0 && (
            <optgroup label={matchingKind === "SCHOOL" ? "School days" : "Holiday days"}>
              {matching.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </optgroup>
          )}
          {other.length > 0 && (
            <optgroup label={matchingKind === "SCHOOL" ? "Holiday days" : "School days"}>
              {other.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </optgroup>
          )}
        </select>
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">Saved as soon as you pick. Dealing will not overwrite it.</p>
    </div>
  );
}
