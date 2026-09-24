"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { inputCls } from "@/components/ui/form";

interface Summary {
  wordsAdded: number;
  wordsUpdated: number;
  meaningsTotal: number;
  skipped: { line: number; text: string; reason: string }[];
}

const PLACEHOLDER = `abate — to lessen in intensity; to reduce in amount
aberrant: deviating from the norm
cardinal — 1. of foremost importance 2. a deep red`;

export default function VocabImport() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSummary(null);

    const res = await fetch("/api/study/vocab/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      if (data.summary) setSummary(data.summary);
    } else {
      setSummary(data);
      setText("");
      startTransition(() => router.refresh());
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={PLACEHOLDER}
        aria-label="Word list"
        className={`${inputCls} font-mono text-xs leading-relaxed`}
      />
      <p className="text-xs text-gray-400">
        One word per line, then <code>—</code>, <code>:</code> or a tab, then the meaning. Several
        meanings on one line separate with <code>;</code> or number them. Pasting a word again
        replaces its meanings rather than duplicating it.
      </p>

      <button
        type="submit"
        disabled={busy || text.trim() === ""}
        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        <Upload className="w-4 h-4" /> {busy ? "Importing…" : "Import"}
      </button>

      {summary && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
          <p>
            <span className="font-semibold">{summary.wordsAdded}</span> added,{" "}
            <span className="font-semibold">{summary.wordsUpdated}</span> updated,{" "}
            <span className="font-semibold">{summary.meaningsTotal}</span> meanings in total.
          </p>
          {summary.skipped.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-amber-700 font-semibold">
                {summary.skipped.length} line{summary.skipped.length === 1 ? "" : "s"} skipped
              </summary>
              <ul className="mt-1.5 space-y-1">
                {summary.skipped.map((s) => (
                  <li key={s.line} className="text-xs text-gray-500">
                    <span className="tabular-nums text-gray-400">line {s.line}</span> — {s.reason}
                    <span className="block font-mono text-[11px] text-gray-400 truncate">{s.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}
