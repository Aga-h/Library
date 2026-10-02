"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Download, Film, Layers, Loader2, Plus, Search, Tag } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { TMDB_NOTICE } from "@/lib/tmdb";

interface Place {
  movieId: string;
  universeId: string | null;
  universeName: string | null;
}

interface Film {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  place: Place | null;
}

interface Group {
  id: number;
  name: string;
  poster?: string | null;
}

interface Results {
  films: Film[];
  collections: Group[];
  keywords: Group[];
}

interface Preview {
  kind: "collection" | "keyword";
  id: number;
  name: string;
  total: number;
  films: Film[];
}

interface ReportLine {
  tmdbId: number;
  title: string;
  year: number | null;
  outcome: "added" | "linked" | "moved" | "already" | "elsewhere";
  where?: string;
  movieId?: string;
}

interface Summary {
  report: ReportLine[];
  failed: { tmdbId: number; reason: string }[];
}

type Status = "WANT_TO_WATCH" | "WATCHED";

/** Where a film already is, put relative to where it is being imported. */
function placeLabel(place: Place | null, target: string | null): { text: string; importable: boolean } | null {
  if (!place) return null;
  if (place.universeId === target) return { text: target ? "Already here" : "In your library", importable: false };
  if (place.universeId === null) return { text: "Standalone — moves here", importable: true };
  return { text: `In ${place.universeName ?? "another universe"}`, importable: false };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function Poster({ src }: { src: string | null }) {
  return (
    <div className="relative flex-shrink-0 w-9 h-[54px] rounded bg-gray-100 overflow-hidden flex items-center justify-center">
      {src ? <Image fill unoptimized src={src} alt="" className="object-cover" sizes="36px" /> : <Film className="w-4 h-4 text-gray-300" />}
    </div>
  );
}

/**
 * Find films on TMDB and log them with their details filled in: one at a time, or a whole
 * collection ("Harry Potter Collection") or keyword tag ("marvel cinematic universe") at once,
 * picked from a preview. Search runs on submit, not on every keystroke.
 */
export default function TmdbImport({
  universes,
  initialUniverseId,
}: {
  universes: { id: string; name: string }[];
  initialUniverseId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(initialUniverseId ?? "");
  const [status, setStatus] = useState<Status>("WANT_TO_WATCH");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | "bulk" | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const targetId = target || null;
  const targetName = universes.find((u) => u.id === target)?.name ?? null;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setSummary(null);
    setPreview(null);
    const res = await fetch(`/api/movies/tmdb/search?${new URLSearchParams({ q: query.trim() })}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    setResults(data);
  }

  async function openList(kind: Preview["kind"], group: Group) {
    setOpening(`${kind}:${group.id}`);
    setError(null);
    setSummary(null);
    const res = await fetch(`/api/movies/tmdb/list?${new URLSearchParams({ [kind]: String(group.id) })}`);
    const data = await res.json().catch(() => ({}));
    setOpening(null);
    if (!res.ok) {
      setError(data.error ?? "Couldn't load that list");
      return;
    }
    const films: Film[] = data.films;
    setPreview({ kind, id: group.id, name: data.name, total: data.total, films });
    setSelected(new Set(films.filter((f) => placeLabel(f.place, targetId)?.importable ?? true).map((f) => f.id)));
  }

  /** Every film that now sits where it was imported to gets that as its place. */
  function placed(films: Film[], report: ReportLine[]): Film[] {
    const landed = new Map(
      report.filter((r) => r.outcome !== "elsewhere" && r.movieId).map((r) => [r.tmdbId, r.movieId!]),
    );
    return films.map((f) =>
      landed.has(f.id)
        ? { ...f, place: { movieId: landed.get(f.id)!, universeId: targetId, universeName: targetName } }
        : f,
    );
  }

  async function importIds(tmdbIds: number[]): Promise<Summary | null> {
    const res = await fetch("/api/movies/tmdb/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universeId: targetId, tmdbIds, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return null;
    }
    return data as Summary;
  }

  async function addOne(film: Film) {
    setBusy(film.id);
    setError(null);
    setSummary(null);
    const done = await importIds([film.id]);
    setBusy(null);
    if (!done) return;
    setResults((r) => (r ? { ...r, films: placed(r.films, done.report) } : r));
    if (done.failed.length > 0 || done.report.some((line) => line.outcome === "elsewhere")) setSummary(done);
    router.refresh();
  }

  async function importSelected() {
    if (!preview || selected.size === 0) return;
    setBusy("bulk");
    setError(null);
    setSummary(null);
    const done = await importIds(preview.films.filter((f) => selected.has(f.id)).map((f) => f.id));
    setBusy(null);
    if (!done) return;
    // Nothing to report → straight to where they landed. Anything left behind is shown first.
    if (done.failed.length === 0 && !done.report.some((line) => line.outcome === "elsewhere")) {
      router.push(targetId ? `/library/movies/u/${targetId}` : "/library/movies");
      router.refresh();
      return;
    }
    setPreview((p) => (p ? { ...p, films: placed(p.films, done.report) } : p));
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

  const count = (outcome: ReportLine["outcome"]) => summary?.report.filter((r) => r.outcome === outcome).length ?? 0;
  // A film TMDB had no details for is known here only by the list that offered it.
  const nameOf = (tmdbId: number) => {
    const film = preview?.films.find((f) => f.id === tmdbId) ?? results?.films.find((f) => f.id === tmdbId);
    return film ? `${film.title}${film.year ? ` (${film.year})` : ""}` : `TMDB film ${tmdbId}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="tmdb-target" className="block text-xs font-semibold text-gray-500 mb-1">Add to</label>
          <select id="tmdb-target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
            <option value="">Standalone (no universe)</option>
            {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <span className="block text-xs font-semibold text-gray-500 mb-1">New films are marked</span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg" role="group" aria-label="New films are marked">
            {(["WANT_TO_WATCH", "WATCHED"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  status === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}>
                {s === "WATCHED" ? "Watched" : "Want to watch"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="tmdb-query" className="sr-only">Search TMDB</label>
        <input id="tmdb-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          placeholder="A film, a franchise, or a tag like “marvel cinematic”" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={searching || query.trim().length < 2}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 space-y-1">
          <p>
            {[
              count("added") && `${plural(count("added"), "film")} added`,
              count("moved") && `${count("moved")} moved here`,
              count("linked") && `${count("linked")} matched to films you'd added by hand`,
              count("already") && `${count("already")} already here`,
            ].filter(Boolean).join(" · ") || "Nothing new to add."}
          </p>
          {count("elsewhere") > 0 && (
            <>
              <p className="text-emerald-800">Left where they are — move them from the film&apos;s Edit page if you want:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.report.filter((r) => r.outcome === "elsewhere").map((r) => (
                  <li key={r.tmdbId}>{r.title}{r.year && ` (${r.year})`} — in {r.where}</li>
                ))}
              </ul>
            </>
          )}
          {summary.failed.length > 0 && (
            <>
              <p className="text-emerald-800">Couldn&apos;t be imported — add {summary.failed.length === 1 ? "it" : "them"} by hand:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.failed.map((f) => <li key={f.tmdbId}>{nameOf(f.tmdbId)} — {f.reason}</li>)}
              </ul>
            </>
          )}
          <Link href={targetId ? `/library/movies/u/${targetId}` : "/library/movies"} className="inline-block font-semibold underline">
            Open {targetName ?? "Movies"} →
          </Link>
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
                {preview.total > preview.films.length
                  ? `The first ${preview.films.length} of ${preview.total} — a broad tag; a collection or a narrower tag may fit better`
                  : plural(preview.films.length, "film")}
              </p>
            </div>
          </div>

          {preview.films.length === 0 ? (
            <p className="px-3 py-6 text-sm text-gray-500 text-center">TMDB lists no films here.</p>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
                <span className="text-gray-500">{selected.size} selected</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setSelected(new Set(preview.films.map((f) => f.id)))}
                    className="font-semibold text-gray-600 hover:text-gray-900">All</button>
                  <button type="button" onClick={() => setSelected(new Set())}
                    className="font-semibold text-gray-600 hover:text-gray-900">None</button>
                </span>
              </div>
              <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                {preview.films.map((f) => {
                  const where = placeLabel(f.place, targetId);
                  return (
                    <li key={f.id}>
                      <label className="flex items-center gap-3 px-3 py-2 bg-white cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)}
                          className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
                        <Poster src={f.poster} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate">{f.title}</span>
                          <span className="block text-xs text-gray-500">{f.year ?? "No date yet"}</span>
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
                <p className="text-[11px] text-gray-500">Films you already have only get their blanks filled in.</p>
                <button type="button" onClick={importSelected} disabled={busy !== null || selected.size === 0}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
                  {busy === "bulk"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing {plural(selected.size, "film")}…</>
                    : <><Download className="w-3.5 h-3.5" /> Import {plural(selected.size, "film")}</>}
                </button>
              </div>
            </>
          )}
        </div>
      ) : results && (
        <div className="space-y-4">
          {results.films.length + results.collections.length + results.keywords.length === 0 && (
            <p className="text-sm text-gray-500">Nothing on TMDB matches that. Try fewer words.</p>
          )}

          {(results.collections.length > 0 || results.keywords.length > 0) && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Whole franchises</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {results.collections.map((c) => (
                  <GroupRow key={`c${c.id}`} icon={Layers} name={c.name} hint="Collection" poster={c.poster ?? null}
                    loading={opening === `collection:${c.id}`} disabled={opening !== null}
                    onOpen={() => openList("collection", c)} />
                ))}
                {results.keywords.map((k) => (
                  <GroupRow key={`k${k.id}`} icon={Tag} name={k.name} hint="Every film with this tag" poster={null}
                    loading={opening === `keyword:${k.id}`} disabled={opening !== null}
                    onOpen={() => openList("keyword", k)} />
                ))}
              </ul>
            </section>
          )}

          {results.films.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Films</h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {results.films.map((f) => {
                  const where = placeLabel(f.place, targetId);
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2 bg-white">
                      <Poster src={f.poster} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{f.title}</p>
                        <p className="text-xs text-gray-500">{f.year ?? "No date yet"}</p>
                      </div>
                      {where && !where.importable ? (
                        <Link href={`/library/movies/${f.place!.movieId}`}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0">
                          {where.text === "Already here" || where.text === "In your library" ? <Check className="w-3 h-3" /> : null}
                          {where.text}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => addOne(f)} disabled={busy !== null}
                          className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
                          {busy === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
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

      <p className="flex items-start gap-2 text-[11px] text-gray-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tmdb-logo.svg" alt="TMDB" className="h-2.5 mt-0.5 flex-shrink-0" />
        <span>{TMDB_NOTICE}</span>
      </p>
    </div>
  );
}

function GroupRow({
  icon: Icon, name, hint, poster, loading, disabled, onOpen,
}: {
  icon: typeof Layers;
  name: string;
  hint: string;
  poster: string | null;
  loading: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 bg-white">
      {poster ? <Poster src={poster} /> : (
        <div className="flex-shrink-0 w-9 h-[54px] rounded bg-gray-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <button type="button" onClick={onOpen} disabled={disabled}
        className="flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />} See films
      </button>
    </li>
  );
}
