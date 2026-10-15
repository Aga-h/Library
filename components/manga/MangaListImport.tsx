"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, FileUp, Loader2, Square, User } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MalNotice } from "@/components/tmdb/TmdbParts";
import { Toggle } from "@/components/anime/MalImport";
import { LANGUAGE_OPTIONS, type LanguageKey } from "@/lib/constants/languages";
import { getJson } from "@/lib/fetch-retry";
import { searchQuery } from "@/lib/mal-list";
import type { MalManga } from "@/lib/mal-manga";
import {
  MANGA_LEFT_OUT_LABELS, isAnimeExport, mangaLeftOut, pickManga, rowsFromMangaExport, rowsFromMangaSheet,
  type MangaLeftOut, type MangaListRow,
} from "@/lib/mal-manga-list";
import { readFirstSheetWithLinks } from "@/lib/xlsx-lite";

interface Outcome {
  added: number;
  linked: number;
  already: number;
  problems: string[];
  /** Lines not imported because something failed — offered to try again without re-reading. */
  failed: string[];
}

const TYPE_LABELS: Record<string, string> = {
  manga: "Manga", manhwa: "Manhwa", manhua: "Manhua", one_shot: "One-shot", doujinshi: "Doujinshi", oel: "OEL",
};

/** Rows from a list file: a copy of the manga list page (.xlsx), or MyAnimeList's export (.xml / .xml.gz). */
async function rowsFromFile(file: File): Promise<MangaListRow[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { rows, links } = await readFirstSheetWithLinks(bytes);
    return rowsFromMangaSheet(rows, links);
  }
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  if (isAnimeExport(text)) throw new Error("That's your anime list — import it from Anime → Import list.");
  if (!text.includes("<myanimelist")) throw new Error("not a list");
  return rowsFromMangaExport(text);
}

/**
 * Import a whole MyAnimeList manga list in one go: everything you finished, as read. Light novels
 * and novels are left out (they go under Books), as is anything not on your Completed list. Each
 * manga goes through the ordinary import, so running it again only adds what is new.
 */
export default function MangaListImport({ defaultLanguage }: { defaultLanguage: LanguageKey }) {
  const [user, setUser] = useState("");
  const [phase, setPhase] = useState<"start" | "loading" | "review" | "importing" | "done">("start");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MangaListRow[]>([]);
  const [have, setHave] = useState<Set<number>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [english, setEnglish] = useState(true);
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const stop = useRef(false);

  async function review(list: MangaListRow[]) {
    if (list.length === 0) {
      setError("No manga found in that list.");
      setPhase("start");
      return;
    }
    const ids = list.map((r) => r.malId).filter((id): id is number => id !== null);
    const { ok, data } = await getJson("/api/manga/mal/places", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ malIds: ids }),
    });
    const inLibrary = new Set(ok ? (data.have as { malId: number }[]).map((h) => h.malId) : []);
    setRows(list);
    setHave(inLibrary);
    setChecked(new Set(list.filter((r) => !mangaLeftOut(r) && !(r.malId && inLibrary.has(r.malId))).map((r) => r.key)));
    setPhase("review");
  }

  async function loadUser(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setPhase("loading");
    const { ok, data } = await getJson(`/api/manga/mal/list?${new URLSearchParams({ user: user.trim() })}`);
    if (!ok) {
      setError(String(data.error ?? "Couldn't read that list"));
      setPhase("start");
      return;
    }
    await review(data.rows as MangaListRow[]);
  }

  async function loadFile(file: File) {
    setError(null);
    setPhase("loading");
    let list: MangaListRow[];
    try {
      list = await rowsFromFile(file);
    } catch (e) {
      const message = e instanceof Error && e.message.includes("Anime") ? e.message : null;
      setError(message ?? "That file isn't a MyAnimeList manga list. Use a copy of your manga list page (.xlsx) or MyAnimeList's export (.xml).");
      setPhase("start");
      return;
    }
    await review(list);
  }

  function toggle(key: string) {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function importChecked(only?: string[]) {
    const wanted = new Set(only ?? checked);
    const order = rows.filter((r) => wanted.has(r.key));
    if (order.length === 0) return;
    setPhase("importing");
    setError(null);
    stop.current = false;
    const result: Outcome = { added: 0, linked: 0, already: 0, problems: [], failed: [] };

    for (let i = 0; i < order.length; i++) {
      const row = order[i];
      if (stop.current) {
        result.failed.push(...order.slice(i).map((r) => r.key));
        result.problems.unshift(`Stopped after ${i} of ${order.length}.`);
        break;
      }
      setProgress({ done: i, total: order.length, label: `Importing ${row.title}` });

      // A line with only a title is found by an exact title match — never a guess.
      let malId = row.malId;
      if (malId === null) {
        const query = searchQuery(row.title);
        const found = query.length >= 3 ? await getJson(`/api/manga/mal/search?${new URLSearchParams({ q: query })}`) : null;
        if (found && !found.ok) {
          result.problems.push(`${row.title}: ${String(found.data.error ?? "search failed")}`);
          if (found.status === 503) { result.failed.push(...order.slice(i).map((r) => r.key)); break; }
          result.failed.push(row.key);
          continue;
        }
        malId = found ? pickManga(row, found.data.entries as MalManga[])?.id ?? null : null;
        if (malId === null) {
          result.problems.push(`${row.title}: not found on MyAnimeList under that title — add it from Add Manga`);
          continue;
        }
      }

      const res = await getJson("/api/manga/mal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ malId, read: true, english, language }),
      });
      if (!res.ok) {
        result.problems.push(`${row.title}: ${String(res.data.error ?? "import failed")}`);
        // MyAnimeList not set up on the site: nothing further can work.
        if (res.status === 503) { result.failed.push(...order.slice(i).map((r) => r.key)); break; }
        // A novel (400) or a clash (409) won't change by trying again.
        if (res.status !== 400 && res.status !== 409) result.failed.push(row.key);
        continue;
      }
      if (res.data.outcome === "added") result.added++;
      else if (res.data.outcome === "linked") result.linked++;
      else result.already++;
    }
    setProgress({ done: order.length - result.failed.length, total: order.length, label: "" });
    setOutcome(result);
    setPhase("done");
  }

  if (phase === "start") {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle label="Titles" value={english} onChange={setEnglish} off="Japanese" on="English" />
          <div>
            <label htmlFor="list-language" className="block text-xs font-semibold text-gray-500 mb-1">Read in</label>
            <select id="list-language" value={language} onChange={(e) => setLanguage(e.target.value as LanguageKey)} className={inputCls}>
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <form onSubmit={loadUser} className="space-y-2">
          <label htmlFor="mal-user" className="block text-xs font-semibold text-gray-500">Your MyAnimeList username</label>
          <div className="flex gap-2">
            <input id="mal-user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off"
              placeholder="e.g. YourName" className={`${inputCls} flex-1`} />
            <button type="submit" disabled={user.trim().length < 2}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
              <User className="w-4 h-4" /> Load list
            </button>
          </div>
          <p className="text-[11px] text-gray-500">Reads your public list&apos;s Completed manga through MyAnimeList&apos;s API.</p>
        </form>
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-gray-500">Or upload your list</span>
          <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-4 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50">
            <FileUp className="w-4 h-4" /> Choose a file
            <input type="file" accept=".xlsx,.xml,.gz" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
          </label>
          <p className="text-[11px] text-gray-500">
            A copy of your Completed manga list page saved as .xlsx, or MyAnimeList&apos;s own manga export
            (.xml or .xml.gz, from your profile&apos;s Export).
          </p>
        </div>
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
        <MalNotice kind="Manga" />
      </div>
    );
  }

  if (phase === "loading" || phase === "importing") {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Loader2 className="w-4 h-4 animate-spin" /> {phase === "loading" ? "Reading your list…" : progress.label || "Working…"}
        </p>
        {phase === "importing" && (
          <>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-500">
              {progress.done} of {progress.total} done. Keep this page open — if MyAnimeList asks it to slow down, it waits and carries on.
            </p>
            <button type="button" onClick={() => { stop.current = true; }}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50">
              <Square className="w-3 h-3" /> Stop
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === "done" && outcome) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">
            {[
              `${outcome.added} added as read`,
              outcome.linked && `${outcome.linked} matched to ones you'd added by hand`,
              outcome.already && `${outcome.already} already there`,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        {outcome.problems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Not imported</p>
            <ul className="text-xs list-disc pl-5 space-y-0.5">{outcome.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {outcome.failed.length > 0 && (
            <button type="button" onClick={() => importChecked(outcome.failed)}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700">
              <Download className="w-4 h-4" /> Try the {outcome.failed.length} not imported again
            </button>
          )}
          <Link href="/library/manga" className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">
            <Check className="w-4 h-4" /> See your manga
          </Link>
        </div>
      </div>
    );
  }

  // Review: what comes in, and what is left out and why.
  const coming = rows.filter((r) => !mangaLeftOut(r));
  const leftOut = new Map<MangaLeftOut, MangaListRow[]>();
  for (const r of rows) {
    const why = mangaLeftOut(r);
    if (why) leftOut.set(why, [...(leftOut.get(why) ?? []), r]);
  }
  const titleOnly = coming.filter((r) => r.malId === null).length;

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-xs">
          <span className="font-semibold text-gray-600">{checked.size} of {coming.length} to import as read</span>
          <span className="flex gap-3">
            <button type="button" onClick={() => setChecked(new Set(coming.map((r) => r.key)))} className="font-semibold text-gray-600 hover:text-gray-900">All</button>
            <button type="button" onClick={() => setChecked(new Set())} className="font-semibold text-gray-600 hover:text-gray-900">None</button>
          </span>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
          {coming.map((r) => {
            const inLibrary = r.malId !== null && have.has(r.malId);
            return (
              <li key={r.key}>
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={checked.has(r.key)} onChange={() => toggle(r.key)}
                    className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{r.title}</span>
                    <span className="block text-xs text-gray-500">
                      {[TYPE_LABELS[r.mediaType], r.malId === null && "found by its title when imported"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {inLibrary && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">In your library</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500">
            Each comes in with its author, artist, counts and cover, every chapter read. Ones you have keep what you set.
            {titleOnly > 0 && ` ${titleOnly} without a MyAnimeList link are looked up by their exact title.`}
          </p>
          <button type="button" onClick={() => importChecked()} disabled={checked.size === 0}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> Import {checked.size} as read
          </button>
        </div>
      </div>

      {leftOut.size > 0 && (
        <details className="border border-gray-200 rounded-lg overflow-hidden">
          <summary className="px-3 py-2.5 bg-gray-50 text-xs font-semibold text-gray-600 cursor-pointer">
            Left out: {[...leftOut.values()].reduce((n, l) => n + l.length, 0)}
          </summary>
          {[...leftOut].map(([why, list]) => (
            <div key={why} className="border-t border-gray-100">
              <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">{MANGA_LEFT_OUT_LABELS[why]} · {list.length}</p>
              <ul className="px-3 pb-2 text-sm text-gray-700">{list.map((r) => <li key={r.key} className="truncate">{r.title}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
      <button type="button" onClick={() => setPhase("start")} className="text-xs font-semibold text-gray-500 hover:text-gray-800">← Pick another list</button>
      <MalNotice kind="Manga" />
    </div>
  );
}
