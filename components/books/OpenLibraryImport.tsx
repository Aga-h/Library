"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Download, Link2, Loader2, Search } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import HierarchySelect, { type HierarchyOption } from "@/components/ui/HierarchySelect";
import {
  Poster, CatalogNotice, resultBodyCls, resultTextCls, resultTitleCls, resultWideCls,
  reveal, revealCls, tinyButtonCls, tinyButtonsCls,
} from "@/components/tmdb/TmdbParts";
import { Toggle } from "@/components/anime/MalImport";
import { LANGUAGE_OPTIONS, type LanguageKey } from "@/lib/constants/languages";

interface Place {
  bookId: string;
  title: string;
  linked: boolean;
  seriesId: string | null;
  seriesName: string | null;
}

interface Work {
  id: string;
  title: string;
  author: string;
  year: number | null;
  pages: number;
  cover: string | null;
  coverThumb: string | null;
  publisher: string | null;
  openLibraryId: string | null;
  googleBooksId: string | null;
  place: Place | null;
}

interface ReportLine {
  id: string;
  openLibraryId: string | null;
  googleBooksId: string | null;
  title: string;
  year: number | null;
  outcome: "added" | "linked" | "moved" | "already" | "elsewhere";
  where?: string;
  bookId?: string;
}

interface Summary {
  report: ReportLine[];
  failed: { id: string; reason: string }[];
  seriesId: string | null;
}

function meta(w: Work): string {
  return [
    w.author !== "Unknown" ? w.author : null,
    w.year,
    `${w.pages} pages`,
  ].filter(Boolean).join(" · ");
}

function placeLabel(place: Place | null, target: string | null): { text: string; importable: boolean } | null {
  if (!place) return null;
  if (!place.linked) return { text: "Link yours", importable: true };
  if (place.seriesId === target) return { text: target ? "Already here" : "In your library", importable: false };
  if (place.seriesId === null) return { text: "Standalone — moves here", importable: true };
  return { text: `In ${place.seriesName ?? "another series"}`, importable: false };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Find a book on Open Library or Google Books and add it — author, page count and cover come
 * with it. One already in the library is opened, never added twice; one you added by hand under
 * the same title is linked instead. Tick several (a search for a series lists its books) to
 * import them into the series you pick. Matches start unticked. With `link`, picking a work
 * links that book.
 */
export default function OpenLibraryImport({
  seriesOptions,
  initialSeriesId,
  defaultLanguage,
  link,
}: {
  seriesOptions: HierarchyOption[];
  initialSeriesId: string | null;
  defaultLanguage: LanguageKey;
  link?: { bookId: string; title: string };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(link?.title ?? "");
  const [results, setResults] = useState<Work[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(initialSeriesId ?? "");
  const [read, setRead] = useState(false);
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | "bulk" | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const targetId = target || null;
  const targetName = seriesOptions.find((s) => s.id === target)?.name ?? null;

  async function runSearch(ev: React.FormEvent) {
    ev.preventDefault();
    if (query.trim().length < 2 && query.replace(/[-\s]/g, "").length < 10) return;
    setSearching(true);
    setError(null);
    setSummary(null);
    setNotice(null);
    const res = await fetch(`/api/books/openlibrary/search?${new URLSearchParams({ q: query.trim() })}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    const works: Work[] = data.works;
    setResults(works);
    setSelected(new Set());
    setNotice(typeof data.notice === "string" && data.notice ? data.notice : null);
  }

  function placed(works: Work[], report: ReportLine[]): Work[] {
    const landed = new Map(
      report.filter((r) => r.outcome !== "elsewhere" && r.bookId).map((r) => [r.id, r.bookId!]),
    );
    return works.map((w) =>
      landed.has(w.id)
        ? {
            ...w,
            place: {
              bookId: landed.get(w.id)!,
              title: w.title,
              linked: true,
              seriesId: targetId,
              seriesName: targetName,
            },
          }
        : w,
    );
  }

  async function importWorks(works: Work[]): Promise<Summary | null> {
    const res = await fetch("/api/books/openlibrary/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: works.map((w) => ({
          ...(w.openLibraryId ? { openLibraryId: w.openLibraryId } : {}),
          ...(w.googleBooksId ? { googleBooksId: w.googleBooksId } : {}),
          title: w.title,
        })),
        read,
        language,
        seriesId: targetId,
        ...(link ? { bookId: link.bookId } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? (link ? "Couldn't link it" : "Import failed"));
      return null;
    }
    return data as Summary;
  }

  async function addOne(work: Work) {
    setBusy(work.id);
    setError(null);
    setSummary(null);
    const done = await importWorks([work]);
    setBusy(null);
    if (!done) return;
    if (link) {
      router.refresh();
      return;
    }
    if (done.failed.length === 0 && done.report.every((line) => line.outcome === "added" || line.outcome === "moved" || line.outcome === "linked" || line.outcome === "already")) {
      const id = done.report[0]?.bookId;
      if (id && done.report.length === 1 && done.report[0].outcome === "added") {
        router.push(`/library/books/${id}`);
        router.refresh();
        return;
      }
    }
    setResults((r) => (r ? placed(r, done.report) : r));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(work.id);
      return next;
    });
    if (done.failed.length > 0 || done.report.some((line) => line.outcome === "elsewhere")) setSummary(done);
    router.refresh();
  }

  async function importSelected() {
    if (!results || selected.size === 0) return;
    setBusy("bulk");
    setError(null);
    setSummary(null);
    const done = await importWorks(results.filter((w) => selected.has(w.id)));
    setBusy(null);
    if (!done) return;
    if (done.failed.length === 0 && !done.report.some((line) => line.outcome === "elsewhere")) {
      router.push(targetId ? `/library/books/s/${targetId}` : "/library/books");
      router.refresh();
      return;
    }
    setResults((r) => (r ? placed(r, done.report) : r));
    setSelected(new Set());
    setSummary(done);
    router.refresh();
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const count = (outcome: ReportLine["outcome"]) => summary?.report.filter((r) => r.outcome === outcome).length ?? 0;
  const nameOf = (id: string) => {
    const work = results?.find((w) => w.id === id);
    return work ? `${work.title}${work.year ? ` (${work.year})` : ""}` : id;
  };

  return (
    <div className="space-y-4">
      {!link && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <HierarchySelect
            value={target}
            onChange={setTarget}
            options={seriesOptions}
            emptyLabel="Standalone (no series)"
          />
          <Toggle label="Mark it" value={read} onChange={setRead} off="To read" on="Read" />
          <div>
            <label htmlFor="book-language" className="block text-xs font-semibold text-gray-500 mb-1">Reading it in</label>
            <select id="book-language" value={language} onChange={(ev) => setLanguage(ev.target.value as LanguageKey)} className={inputCls}>
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="book-query" className="sr-only">Search books</label>
        <input id="book-query" type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} autoFocus={!link}
          placeholder="A title, an author, or an ISBN" className={`${inputCls} flex-1 min-w-0`} />
        <button type="submit" disabled={searching || query.trim().length < 2}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} <span className="max-sm:sr-only">Search</span>
        </button>
      </form>

      {error && <div ref={reveal} role="alert" className={`bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm break-words ${revealCls}`}>{error}</div>}
      {notice && !error && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{notice}</p>}

      {summary && (
        <div ref={reveal} className={`bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 space-y-1 ${revealCls}`}>
          <p>
            {[
              count("added") && `${plural(count("added"), "book")} added`,
              count("moved") && `${count("moved")} moved here`,
              count("linked") && `${count("linked")} matched to books you'd added by hand`,
              count("already") && `${count("already")} already here`,
            ].filter(Boolean).join(" · ") || "Nothing new to add."}
          </p>
          {count("elsewhere") > 0 && (
            <>
              <p className="text-emerald-800">Left where they are — move them from the book&apos;s Edit page if you want:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.report.filter((r) => r.outcome === "elsewhere").map((r) => (
                  <li key={r.id}>{r.title}{r.year && ` (${r.year})`} — in {r.where}</li>
                ))}
              </ul>
            </>
          )}
          {summary.failed.length > 0 && (
            <>
              <p className="text-emerald-800">Couldn&apos;t be imported — add {summary.failed.length === 1 ? "it" : "them"} by hand:</p>
              <ul className="text-xs text-emerald-800 list-disc pl-5">
                {summary.failed.map((f) => <li key={f.id}>{nameOf(f.id)} — {f.reason}</li>)}
              </ul>
            </>
          )}
          <Link href={targetId ? `/library/books/s/${targetId}` : "/library/books"} className="inline-block font-semibold underline">
            Open {targetName ?? "Books"} →
          </Link>
        </div>
      )}

      {results && (results.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing with a page count on Open Library or Google Books matches that. Try fewer words, or an ISBN.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {!link && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
              <span className="text-gray-500">{selected.size} selected</span>
              <span className={tinyButtonsCls}>
                <button type="button"
                  onClick={() => setSelected(new Set(results.map((w) => w.id)))}
                  className={tinyButtonCls}>All</button>
                <button type="button" onClick={() => setSelected(new Set())} className={tinyButtonCls}>None</button>
              </span>
            </div>
          )}
          <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {results.map((w) => {
              const where = placeLabel(w.place, targetId);
              return (
                <li key={w.id} className="flex items-center max-sm:flex-wrap gap-3 max-sm:gap-y-2 px-3 py-2 bg-white">
                  {!link && (
                    <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)}
                      disabled={where ? !where.importable : false}
                      className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                      aria-label={`Select ${w.title}`} />
                  )}
                  <Poster src={w.coverThumb ?? w.cover} />
                  <div className={`${resultBodyCls} max-sm:basis-[calc(100%-3rem)]`}>
                    <div className={resultTextCls}>
                      <p className={`${resultTitleCls} ${resultWideCls}`}>{w.title}</p>
                      <p className="text-xs text-gray-500 max-sm:break-words sm:truncate">{meta(w)}</p>
                    </div>
                    <div className="flex-shrink-0 max-sm:ml-0">
                      <RowAction work={w} where={where} link={link} busy={busy} onPick={addOne} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!link && (
            <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">Nothing is ticked until you pick it. Books you already have only get their blanks filled in.</p>
              <button type="button" onClick={importSelected} disabled={busy !== null || selected.size === 0}
                className="flex items-center justify-center gap-1.5 bg-gray-900 text-white px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
                {busy === "bulk"
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing {plural(selected.size, "book")}…</>
                  : <><Download className="w-3.5 h-3.5" /> Import {plural(selected.size, "book")}</>}
              </button>
            </div>
          )}
        </div>
      ))}

      <CatalogNotice />
    </div>
  );
}

const pillCls = "flex items-center gap-1 text-[11px] font-semibold px-2 py-1 max-sm:py-2.5 rounded-full max-sm:rounded-xl max-sm:break-words sm:flex-shrink-0";
const buttonCls = "flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0";

function RowAction({ work: w, where, link, busy, onPick }: {
  work: Work;
  where: { text: string; importable: boolean } | null;
  link?: { bookId: string; title: string };
  busy: string | "bulk" | null;
  onPick: (w: Work) => void;
}) {
  if (link) {
    if (w.place?.linked && w.place.bookId !== link.bookId) {
      return (
        <Link href={`/library/books/${w.place.bookId}`} className={`${pillCls} bg-gray-100 text-gray-600 hover:bg-gray-200`}>
          <Check className="w-3 h-3 flex-shrink-0" /> Already {w.place.title}
        </Link>
      );
    }
  } else if (where && !where.importable && w.place) {
    return (
      <Link href={`/library/books/${w.place.bookId}`} className={`${pillCls} bg-gray-100 text-gray-600 hover:bg-gray-200`}>
        <Check className="w-3 h-3 flex-shrink-0" /> {where.text}
      </Link>
    );
  }
  const linking = !!link || (!!w.place && !w.place.linked);
  const label = linking ? (link ? "Link" : "Link yours") : "Add";
  return (
    <button type="button" onClick={() => onPick(w)} disabled={busy !== null} aria-label={`${label}: ${w.title}`}
      title={w.place && !w.place.linked && !link ? `Links "${w.place.title}", which you added by hand` : undefined}
      className={buttonCls}>
      {busy === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : linking ? <Link2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
