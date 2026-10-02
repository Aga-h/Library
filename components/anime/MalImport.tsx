"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Download, Layers, Loader2, Search } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MalNotice, Poster } from "@/components/tmdb/TmdbParts";
import { UNTICKED_MEDIA } from "@/lib/mal";

interface Place {
  animeId: string;
  seriesId: string | null;
  seriesName: string | null;
  universeId: string | null;
  universeName: string | null;
}

interface Entry {
  id: number;
  title: string;
  titleEn: string | null;
  year: number | null;
  mediaType: string;
  airing: "finished" | "airing" | "upcoming";
  episodes: number | null;
  poster: string | null;
  place: Place | null;
}

interface Run {
  startId: number;
  entries: Entry[];
  truncated: boolean;
}

interface EntryLine {
  malId: number;
  title: string;
  outcome: "added" | "linked" | "moved" | "already" | "elsewhere";
  where?: string;
  animeId?: string;
}

interface Result {
  seriesId: string | null;
  seriesName: string | null;
  seriesOutcome: "added" | "already" | "moved" | "linked" | "elsewhere" | null;
  where?: string;
  entries: EntryLine[];
  failed: { malId: number; reason: string }[];
}

const MEDIA: Record<string, string> = {
  tv: "TV", movie: "Movie", ova: "OVA", ona: "ONA", special: "Special", tv_special: "TV Special",
  music: "Music", pv: "Promo", cm: "Ad",
};

function meta(e: Entry): string {
  return [
    MEDIA[e.mediaType] ?? null,
    e.year ?? "Not aired yet",
    e.episodes ? `${e.episodes} ep` : null,
    e.airing === "airing" ? "airing" : null,
  ].filter(Boolean).join(" · ");
}

/** Where an entry already is, put relative to where it is being imported. */
function placeLabel(place: Place | null, target: string | null): { text: string; importable: boolean } | null {
  if (!place) return null;
  if (place.seriesId === null) {
    return target ? { text: "Standalone — moves here", importable: true } : { text: "In your library", importable: false };
  }
  if (place.universeId === target) return { text: target ? "Already here" : `In ${place.seriesName}`, importable: false };
  if (place.universeId === null) return { text: `In ${place.seriesName} — moves here`, importable: true };
  return { text: `In ${place.universeName ?? "another universe"}`, importable: false };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Find anime on MyAnimeList and log a whole run at once: pick any entry and every season, film and
 * special linked to it as a sequel or prequel is listed in watch order, to tick and import as a
 * series. Search runs on submit, not on every keystroke.
 */
export default function MalImport({
  universes,
  initialUniverseId,
}: {
  universes: { id: string; name: string }[];
  initialUniverseId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(initialUniverseId ?? "");
  const [watched, setWatched] = useState(false);
  const [english, setEnglish] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Result | null>(null);

  const targetId = target || null;
  const shown = (e: { title: string; titleEn: string | null }) => (english && e.titleEn ? e.titleEn : e.title);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setError(null);
    setSummary(null);
    setRun(null);
    const res = await fetch(`/api/anime/mal/search?${new URLSearchParams({ q: query.trim() })}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    setResults(data.entries);
  }

  async function openRun(entry: Entry) {
    setOpening(entry.id);
    setError(null);
    setSummary(null);
    const res = await fetch(`/api/anime/mal/run?${new URLSearchParams({ id: String(entry.id) })}`);
    const data = await res.json().catch(() => ({}));
    setOpening(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't load that series");
      return;
    }
    const entries: Entry[] = data.entries;
    setRun({ startId: entry.id, entries, truncated: data.truncated });
    setSelected(new Set(entries
      .filter((e) => !UNTICKED_MEDIA.has(e.mediaType) && (placeLabel(e.place, targetId)?.importable ?? true))
      .map((e) => e.id)));
  }

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (!run || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    const res = await fetch("/api/anime/mal/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId: targetId, malIds: [...selected], watched, english }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    const done = data as Result;
    // Nothing to report → straight to where it landed. Anything left behind is shown first.
    const clean = done.failed.length === 0 && done.seriesOutcome !== "elsewhere" && !done.entries.some((l) => l.outcome === "elsewhere");
    const landing = done.seriesId ? `/library/anime/s/${done.seriesId}` : done.entries[0]?.animeId ? `/library/anime/${done.entries[0].animeId}` : null;
    if (clean && landing) {
      router.push(landing);
      router.refresh();
      return;
    }
    setSummary(done);
    setSelected(new Set());
    router.refresh();
  }

  const nameOf = (malId: number) => {
    const e = run?.entries.find((x) => x.id === malId) ?? results?.find((x) => x.id === malId);
    return e ? shown(e) : `MyAnimeList entry ${malId}`;
  };
  const count = (o: EntryLine["outcome"]) => summary?.entries.filter((l) => l.outcome === o).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="mal-target" className="block text-xs font-semibold text-gray-500 mb-1">Add to</label>
          <select id="mal-target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
            <option value="">Standalone (no universe)</option>
            {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <Toggle label="New entries are marked" value={watched} onChange={setWatched} off="To watch" on="Watched" />
        <Toggle label="Titles" value={english} onChange={setEnglish} off="Japanese" on="English" />
      </div>
      {watched && <p className="text-[11px] text-gray-500 -mt-2">Finished entries count as fully watched; ones still airing stay at 0 — MyAnimeList has no episode dates.</p>}

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="mal-query" className="sr-only">Search MyAnimeList</label>
        <input id="mal-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="e.g. Attack on Titan" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={searching || query.trim().length < 3}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 space-y-1">
          <p>
            {summary.seriesId && (
              <><Link href={`/library/anime/s/${summary.seriesId}`} className="font-semibold underline">{summary.seriesName}</Link>: </>
            )}
            {[
              count("added") && `${plural(count("added"), "entry", "entries")} added`,
              count("moved") && `${count("moved")} moved in`,
              count("linked") && `${count("linked")} matched to ones you'd added by hand`,
              count("already") && `${count("already")} already there`,
            ].filter(Boolean).join(" · ") || "nothing new to add"}
            {summary.seriesOutcome === "elsewhere" && ` — the series is in ${summary.where}, and stays there`}
          </p>
          {count("elsewhere") > 0 && (
            <>
              <p className="text-emerald-800">Left where they are — move them from their Edit page if you want:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.entries.filter((l) => l.outcome === "elsewhere").map((l) => <li key={l.malId}>{l.title} — in {l.where}</li>)}
              </ul>
            </>
          )}
          {summary.failed.length > 0 && (
            <>
              <p className="text-emerald-800">Couldn&apos;t be imported — add {summary.failed.length === 1 ? "it" : "them"} by hand:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.failed.map((f) => <li key={f.malId}>{nameOf(f.malId)} — {f.reason}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {run ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <button type="button" onClick={() => setRun(null)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-3.5 h-3.5" /> Results
            </button>
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-900 truncate">{run.entries[0] ? shown(run.entries[0]) : "Series"}</p>
              <p className="text-xs text-gray-500">
                {plural(run.entries.length, "entry", "entries")} in watch order
                {run.truncated && " — the 40 nearest the one you picked; a very long franchise"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
            <span className="text-gray-500">{selected.size} selected</span>
            <span className="flex gap-3">
              <button type="button" onClick={() => setSelected(new Set(run.entries.map((e) => e.id)))}
                className="font-semibold text-gray-600 hover:text-gray-900">All</button>
              <button type="button" onClick={() => setSelected(new Set())}
                className="font-semibold text-gray-600 hover:text-gray-900">None</button>
            </span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {run.entries.map((e) => {
              const where = placeLabel(e.place, targetId);
              return (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-3 py-2 bg-white cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)}
                      className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
                    <Poster src={e.poster} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{shown(e)}</span>
                      <span className="block text-xs text-gray-500">{meta(e)}</span>
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
            <p className="text-[11px] text-gray-500">
              {selected.size === 1 && !targetId
                ? "One entry on its own is added as a single anime, not a series."
                : "Ticked entries become one series, in this order. Ones you have only get their blanks filled."}
            </p>
            <button type="button" onClick={importSelected} disabled={busy || selected.size === 0}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
              {busy
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</>
                : <><Download className="w-3.5 h-3.5" /> Import {plural(selected.size, "entry", "entries")}</>}
            </button>
          </div>
        </div>
      ) : results && (
        results.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing on MyAnimeList matches that. Try fewer words.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {results.map((e) => {
              const where = placeLabel(e.place, targetId);
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 bg-white">
                  <Poster src={e.poster} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{shown(e)}</p>
                    <p className="text-xs text-gray-500">{meta(e)}</p>
                  </div>
                  {where && (
                    <Link href={`/library/anime/${e.place!.animeId}`}
                      className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0">
                      <Check className="w-3 h-3" /> {where.text}
                    </Link>
                  )}
                  <button type="button" onClick={() => openRun(e)} disabled={opening !== null}
                    className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
                    {opening === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} See series
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      <MalNotice />
    </div>
  );
}

function Toggle({ label, value, onChange, off, on }: {
  label: string; value: boolean; onChange: (v: boolean) => void; off: string; on: string;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg" role="group" aria-label={label}>
        {[false, true].map((v) => (
          <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              value === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}>
            {v ? on : off}
          </button>
        ))}
      </div>
    </div>
  );
}
