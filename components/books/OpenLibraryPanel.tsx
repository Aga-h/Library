"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react";
import OpenLibraryImport from "@/components/books/OpenLibraryImport";
import { CatalogNotice } from "@/components/tmdb/TmdbParts";
import type { HierarchyOption } from "@/components/ui/HierarchySelect";
import type { LanguageKey } from "@/lib/constants/languages";

const FIELD_LABELS: Record<string, string> = {
  coverImage: "cover", author: "author", publisher: "publisher",
};

const buttonCls = "flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors";

/**
 * A book's link to Open Library and/or Google Books. Linked: check again for a cover it was
 * missing. Not linked (added by hand): find it in the catalogues so the cover can be filled in.
 */
export default function OpenLibraryPanel({
  bookId, title, openLibraryId, googleBooksId, language, seriesOptions,
}: {
  bookId: string;
  title: string;
  openLibraryId: string | null;
  googleBooksId: string | null;
  language: LanguageKey;
  seriesOptions: HierarchyOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const linked = openLibraryId !== null || googleBooksId !== null;

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/books/openlibrary/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't check the catalogues");
      return;
    }
    const changed: string[] = data.changed ?? [];
    setMessage(changed.length ? `Updated ${changed.map((f) => FIELD_LABELS[f] ?? f).join(", ")}` : "Up to date with the catalogues");
    if (changed.length) startTransition(() => router.refresh());
  }

  if (linked) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} disabled={busy} className={buttonCls}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {busy ? "Checking…" : "Check catalogues"}
          </button>
          {openLibraryId && (
            <a href={`https://openlibrary.org/works/${openLibraryId}`} target="_blank" rel="noreferrer" className={buttonCls}>
              <ExternalLink className="w-3.5 h-3.5" /> On Open Library
            </a>
          )}
          {googleBooksId && (
            <a href={`https://books.google.com/books?id=${encodeURIComponent(googleBooksId)}`} target="_blank" rel="noreferrer" className={buttonCls}>
              <ExternalLink className="w-3.5 h-3.5" /> On Google Books
            </a>
          )}
          {message && <span role="status" className="text-xs text-gray-500">{message}</span>}
        </div>
        <CatalogNotice />
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonCls}>
        <Link2 className="w-3.5 h-3.5" /> Find in catalogues
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Pick its work — the cover fills in where yours is blank. Your progress stays.</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-700 flex-shrink-0 max-sm:p-2.5 max-sm:-m-2.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      <OpenLibraryImport
        seriesOptions={seriesOptions}
        initialSeriesId={null}
        defaultLanguage={language}
        link={{ bookId, title }}
      />
    </div>
  );
}
