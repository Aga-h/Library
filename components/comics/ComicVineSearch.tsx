"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Download, Loader2, Search } from "lucide-react";
import { inputCls } from "@/components/ui/form";

interface Volume {
  id: number;
  name: string;
  startYear: number | null;
  issueCount: number;
  publisher: string | null;
  image: string | null;
}

interface Imported {
  titleId: string;
  titleName: string;
  added: number;
  filled: number;
  skipped: { issueNumber: string; reason: string }[];
  total: number;
}

/**
 * Find a run on Comic Vine and import it — the comic and every issue — into this universe.
 * Search runs on submit, not on every keystroke: Comic Vine allows 200 searches an hour.
 */
export default function ComicVineSearch({
  universeId,
  publisherId,
  base,
}: {
  universeId: string;
  publisherId: string;
  /** The universe's URL; an imported comic opens at `${base}/${titleId}`. */
  base: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Volume[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Imported | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setDone(null);
    const params = new URLSearchParams({ q: query.trim(), publisherId });
    const res = await fetch(`/api/comics/comicvine/search?${params}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    setResults(data.results);
  }

  async function importVolume(volume: Volume) {
    setImporting(volume.id);
    setError(null);
    const res = await fetch("/api/comics/comicvine/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId, volumeId: volume.id }),
    });
    const data = await res.json().catch(() => ({}));
    setImporting(null);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    // Nothing to report → straight to the comic. Anything skipped is shown first, so it is seen.
    if (data.skipped.length === 0) {
      router.push(`${base}/${data.titleId}`);
      router.refresh();
      return;
    }
    setDone(data);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="cv-query" className="sr-only">Search Comic Vine</label>
        <input id="cv-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="e.g. Amazing Spider-Man" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={searching || query.trim().length < 2}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {done && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900">
          <p>
            <span className="font-semibold">{done.titleName}</span>: {done.added} issue{done.added === 1 ? "" : "s"} added
            {done.filled > 0 && <>, {done.filled} filled in</>}.
          </p>
          <p className="mt-1 text-emerald-800">
            {done.skipped.length} of Comic Vine&apos;s {done.total} could not be placed — add {done.skipped.length === 1 ? "it" : "them"} by hand if you want {done.skipped.length === 1 ? "it" : "them"}:
          </p>
          <ul className="mt-1 text-xs text-emerald-800 list-disc pl-5">
            {done.skipped.map((s) => <li key={s.issueNumber}>#{s.issueNumber} — {s.reason}</li>)}
          </ul>
          <Link href={`${base}/${done.titleId}`} className="inline-block mt-2 font-semibold underline">Open it →</Link>
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-sm text-gray-500">Nothing on Comic Vine matches that. Try fewer words.</p>
      )}

      {results && results.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {results.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
              <div className="relative flex-shrink-0 w-10 h-14 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
                {v.image ? (
                  <Image fill unoptimized src={v.image} alt="" className="object-cover" sizes="40px" />
                ) : (
                  <BookOpen className="w-4 h-4 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {v.name}{v.startYear && <span className="font-normal text-gray-500"> ({v.startYear})</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {[v.publisher, `${v.issueCount} issue${v.issueCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button onClick={() => importVolume(v)} disabled={importing !== null}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
                {importing === v.id
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing {v.issueCount}…</>
                  : <><Download className="w-3.5 h-3.5" /> Import</>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-gray-400">
        Data from <a href="https://comicvine.gamespot.com" target="_blank" rel="noreferrer" className="underline">Comic Vine</a>.
        Importing a run you already have only adds what is missing — your read and owned marks are never touched.
      </p>
    </div>
  );
}
