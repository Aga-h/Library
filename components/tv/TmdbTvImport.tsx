"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Download, Loader2, Plus, Search, Tag, Tv2 } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { Poster, TmdbNotice } from "@/components/tmdb/TmdbParts";

interface Place {
  seriesId: string;
  universeId: string | null;
  universeName: string | null;
}

interface Show {
  id: number;
  name: string;
  year: number | null;
  poster: string | null;
  place: Place | null;
}

interface Keyword {
  id: number;
  name: string;
}

interface Preview {
  id: number;
  name: string;
  total: number;
  shows: Show[];
}

interface ReportLine {
  tmdbId: number;
  name: string;
  outcome: "added" | "linked" | "moved" | "already" | "elsewhere";
  where?: string;
  seriesId: string;
  seasonsAdded: number[];
  seasonsUpdated: number[];
}

interface Summary {
  report: ReportLine[];
  failed: { tmdbId: number; reason: string }[];
}

/** Where a show already is, put relative to where it is being imported. */
function placeLabel(place: Place | null, target: string | null): { text: string; importable: boolean } | null {
  if (!place) return null;
  if (place.universeId === target) return { text: target ? "Already here" : "In your library", importable: false };
  if (place.universeId === null) return { text: "Standalone — moves here", importable: true };
  return { text: `In ${place.universeName ?? "another universe"}`, importable: false };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What follows the show's name: " — 5 seasons added", " — season 3 added, 1 updated", " — up to date". */
function lineDetail(line: ReportLine): string {
  const parts: string[] = [];
  if (line.seasonsAdded.length > 0) {
    parts.push(line.seasonsAdded.length === 1 ? `season ${line.seasonsAdded[0]} added` : `${plural(line.seasonsAdded.length, "season")} added`);
  }
  if (line.seasonsUpdated.length > 0) parts.push(`${line.seasonsUpdated.length} updated`);
  const what = parts.join(", ") || "up to date";
  const how = {
    added: "",
    moved: " (moved here)",
    linked: " (matched to the series you made)",
    already: "",
    elsewhere: ` (in ${line.where} — left there)`,
  }[line.outcome];
  return ` — ${what}${how}`;
}

/**
 * Find shows on TMDB and log them: each becomes a series with a season row for every season,
 * episodes, runtime and poster included. One at a time, or every show under a keyword tag
 * ("marvel cinematic universe") picked from a preview. Search runs on submit, not per keystroke.
 */
export default function TmdbTvImport({
  universes,
  initialUniverseId,
}: {
  universes: { id: string; name: string }[];
  initialUniverseId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ shows: Show[]; keywords: Keyword[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(initialUniverseId ?? "");
  const [watched, setWatched] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | "bulk" | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const targetId = target || null;
  const targetName = universes.find((u) => u.id === target)?.name ?? null;
  const targetHref = targetId ? `/library/tv/u/${targetId}` : "/library/tv";

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setSummary(null);
    setPreview(null);
    const res = await fetch(`/api/tv/tmdb/search?${new URLSearchParams({ q: query.trim() })}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    setResults(data);
  }

  async function openKeyword(keyword: Keyword) {
    setOpening(keyword.id);
    setError(null);
    setSummary(null);
    const res = await fetch(`/api/tv/tmdb/list?${new URLSearchParams({ keyword: String(keyword.id) })}`);
    const data = await res.json().catch(() => ({}));
    setOpening(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't load that list");
      return;
    }
    const shows: Show[] = data.shows;
    setPreview({ id: keyword.id, name: data.name, total: data.total, shows });
    setSelected(new Set(shows.filter((s) => placeLabel(s.place, targetId)?.importable ?? true).map((s) => s.id)));
  }

  /** Every show that now sits where it was imported to gets that as its place. */
  function placed(shows: Show[], report: ReportLine[]): Show[] {
    const landed = new Map(report.filter((r) => r.outcome !== "elsewhere").map((r) => [r.tmdbId, r.seriesId]));
    return shows.map((s) =>
      landed.has(s.id)
        ? { ...s, place: { seriesId: landed.get(s.id)!, universeId: targetId, universeName: targetName } }
        : s,
    );
  }

  async function importIds(tmdbIds: number[]): Promise<Summary | null> {
    const res = await fetch("/api/tv/tmdb/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId: targetId, tmdbIds, watched }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return null;
    }
    return data as Summary;
  }

  async function addOne(show: Show) {
    setBusy(show.id);
    setError(null);
    setSummary(null);
    const done = await importIds([show.id]);
    setBusy(null);
    if (!done) return;
    setResults((r) => (r ? { ...r, shows: placed(r.shows, done.report) } : r));
    // Always said, even when all went well: how many seasons came in is the useful part.
    setSummary(done);
    router.refresh();
  }

  async function importSelected() {
    if (!preview || selected.size === 0) return;
    setBusy("bulk");
    setError(null);
    setSummary(null);
    const done = await importIds(preview.shows.filter((s) => selected.has(s.id)).map((s) => s.id));
    setBusy(null);
    if (!done) return;
    // Nothing to report → straight to where they landed. Anything left behind is shown first.
    if (done.failed.length === 0 && !done.report.some((line) => line.outcome === "elsewhere")) {
      router.push(targetHref);
      router.refresh();
      return;
    }
    setPreview((p) => (p ? { ...p, shows: placed(p.shows, done.report) } : p));
    setSelected(new Set());
    setSummary(done);
    router.refresh();
  }

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // A show TMDB had no details for is known here only by the list that offered it.
  const nameOf = (tmdbId: number) => {
    const show = preview?.shows.find((s) => s.id === tmdbId) ?? results?.shows.find((s) => s.id === tmdbId);
    return show ? `${show.name}${show.year ? ` (${show.year})` : ""}` : `TMDB show ${tmdbId}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="tmdb-tv-target" className="block text-xs font-semibold text-gray-500 mb-1">Add to</label>
          <select id="tmdb-tv-target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
            <option value="">Standalone (no universe)</option>
            {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-xs font-semibold text-gray-500 mb-1">New seasons are marked</span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg" role="group" aria-label="New seasons are marked">
            {([false, true] as const).map((w) => (
              <button key={String(w)} type="button" onClick={() => setWatched(w)} aria-pressed={watched === w}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  watched === w ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}>
                {w ? "Watched" : "To watch"}
              </button>
            ))}
          </div>
          {watched && <p className="text-[11px] text-gray-500 mt-1">Every aired episode counts as watched; ones still to air don&apos;t.</p>}
        </div>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="tmdb-tv-query" className="sr-only">Search TMDB</label>
        <input id="tmdb-tv-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="A show, or a tag like “star trek”" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={searching || query.trim().length < 2}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 space-y-1">
          {summary.report.length > 0 && (
            <ul className="space-y-0.5">
              {summary.report.map((line) => (
                <li key={line.tmdbId}>
                  <Link href={`/library/tv/s/${line.seriesId}`} className="font-semibold underline">{line.name}</Link>
                  {lineDetail(line)}
                </li>
              ))}
            </ul>
          )}
          {summary.failed.length > 0 && (
            <>
              <p className="text-emerald-800">Couldn&apos;t be imported — add {summary.failed.length === 1 ? "it" : "them"} by hand:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.failed.map((f) => <li key={f.tmdbId}>{nameOf(f.tmdbId)} — {f.reason}</li>)}
              </ul>
            </>
          )}
          <Link href={targetHref} className="inline-block font-semibold underline">Open {targetName ?? "TV Shows"} →</Link>
        </div>
      )}

      {preview ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <button type="button" onClick={() => setPreview(null)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-3.5 h-3.5" /> Results
            </button>
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-900 truncate">{preview.name}</p>
              <p className="text-xs text-gray-500">
                {preview.total > preview.shows.length
                  ? `The first ${preview.shows.length} of ${preview.total} — a broad tag; a narrower one may fit better`
                  : plural(preview.shows.length, "show")}
              </p>
            </div>
          </div>

          {preview.shows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-gray-500 text-center">TMDB lists no shows here.</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
                <span className="text-gray-500">{selected.size} selected</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setSelected(new Set(preview.shows.map((s) => s.id)))}
                    className="font-semibold text-gray-600 hover:text-gray-900">All</button>
                  <button type="button" onClick={() => setSelected(new Set())}
                    className="font-semibold text-gray-600 hover:text-gray-900">None</button>
                </span>
              </div>
              <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                {preview.shows.map((s) => {
                  const where = placeLabel(s.place, targetId);
                  return (
                    <li key={s.id}>
                      <label className="flex items-center gap-3 px-3 py-2 bg-white cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                          className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
                        <Poster src={s.poster} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate">{s.name}</span>
                          <span className="block text-xs text-gray-500">{s.year ?? "Not aired yet"}</span>
                        </span>
                        {where && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            where.importable ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                          }`}>{where.text}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500">Every season comes in. Shows you have only get new seasons and blanks filled.</p>
                <button type="button" onClick={importSelected} disabled={busy !== null || selected.size === 0}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  {busy === "bulk"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing {plural(selected.size, "show")}…</>
                    : <><Download className="w-3.5 h-3.5" /> Import {plural(selected.size, "show")}</>}
                </button>
              </div>
            </>
          )}
        </div>
      ) : results && (
        <div className="space-y-4">
          {results.shows.length + results.keywords.length === 0 && (
            <p className="text-sm text-gray-500">Nothing on TMDB matches that. Try fewer words.</p>
          )}

          {results.keywords.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Whole franchises</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {results.keywords.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 px-3 py-2 bg-white">
                    <div className="flex-shrink-0 w-9 h-[54px] rounded bg-gray-50 flex items-center justify-center">
                      <Tag className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{k.name}</p>
                      <p className="text-xs text-gray-500">Every show with this tag</p>
                    </div>
                    <button type="button" onClick={() => openKeyword(k)} disabled={opening !== null}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
                      {opening === k.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tv2 className="w-3.5 h-3.5" />} See shows
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.shows.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Shows</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {results.shows.map((s) => {
                  const where = placeLabel(s.place, targetId);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2 bg-white">
                      <Poster src={s.poster} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.year ?? "Not aired yet"}</p>
                      </div>
                      {where && !where.importable ? (
                        <Link href={`/library/tv/s/${s.place!.seriesId}`}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0">
                          {s.place!.universeId === targetId ? <Check className="w-3 h-3" /> : null}
                          {where.text}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => addOne(s)} disabled={busy !== null}
                          className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
                          {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          {where ? "Move here" : "Add"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <TmdbNotice />
    </div>
  );
}
