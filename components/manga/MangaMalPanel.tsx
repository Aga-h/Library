"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react";
import MangaMalImport from "@/components/manga/MangaMalImport";
import { MalNotice } from "@/components/tmdb/TmdbParts";
import type { LanguageKey } from "@/lib/constants/languages";

const FIELD_LABELS: Record<string, string> = {
  totalVolumes: "volumes", totalChapters: "chapters", ongoing: "publishing status",
  coverImage: "cover", author: "author", artist: "artist",
};

const buttonCls = "flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors";

/**
 * A manga's link to MyAnimeList. Linked: check it again for final counts once the series ends.
 * Not linked (added by hand): find its entry, so the counts and cover can be filled in.
 */
export default function MangaMalPanel({ mangaId, title, malId, language }: {
  mangaId: string;
  title: string;
  malId: number | null;
  language: LanguageKey;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/manga/mal/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mangaId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't check MyAnimeList");
      return;
    }
    const changed: string[] = data.changed ?? [];
    setMessage(changed.length ? `Updated ${changed.map((f) => FIELD_LABELS[f] ?? f).join(", ")}` : "Up to date with MyAnimeList");
    if (changed.length) startTransition(() => router.refresh());
  }

  if (malId !== null) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} disabled={busy} className={buttonCls}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {busy ? "Checking…" : "Check MyAnimeList"}
          </button>
          <a href={`https://myanimelist.net/manga/${malId}`} target="_blank" rel="noreferrer" className={buttonCls}>
            <ExternalLink className="w-3.5 h-3.5" /> On MyAnimeList
          </a>
          {message && <span role="status" className="text-xs text-gray-500">{message}</span>}
        </div>
        <MalNotice kind="Manga" />
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonCls}>
        <Link2 className="w-3.5 h-3.5" /> Find on MyAnimeList
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Pick its entry — volume and chapter counts, cover and artist fill in where yours are blank. Your progress stays.</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-700 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <MangaMalImport defaultLanguage={language} link={{ mangaId, title }} />
    </div>
  );
}
