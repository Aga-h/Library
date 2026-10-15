"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, FileUp, Loader2, Square, User } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MalNotice, Poster } from "@/components/tmdb/TmdbParts";
import { Toggle } from "@/components/anime/MalImport";
import {
  LEFT_OUT_LABELS, leftOutReason, pickEntry, rowsFromMalExport, rowsFromSheet, searchQuery,
  type LeftOut, type ListRow,
} from "@/lib/mal-list";
import { readFirstSheet } from "@/lib/xlsx-lite";
import { getJson } from "@/lib/fetch-retry";
import type { MalEntry } from "@/lib/mal";

interface Place {
  animeId: string;
  seriesId: string | null;
  seriesName: string | null;
}

type Entry = MalEntry & { place: Place | null };

interface Item {
  entry: Entry;
  reason: LeftOut | null;
}

/** A row of the file that is left out by its own type — no lookup needed to know. */
interface Skipped {
  row: ListRow;
  reason: LeftOut;
}

interface Outcome {
  added: number;
  linked: number;
  already: number;
  series: number;
  problems: string[];
  /** Seasons not imported — offered to try again, without reading the list again. */
  failed: number[];
}

const MEDIA: Record<string, string> = {
  tv: "TV", ona: "ONA", movie: "Film", ova: "OVA", special: "Special", tv_special: "TV special",
  music: "Music", pv: "Promo", cm: "Ad",
};

function meta(e: MalEntry): string {
  return [
    MEDIA[e.mediaType] ?? e.mediaType,
    e.year,
    e.episodes ? `${e.episodes} ep` : null,
    e.duration ? `${e.duration} min` : null,
  ].filter(Boolean).join(" · ");
}

/** Rows from a list file: a copy of the list page (.xlsx), or MyAnimeList's export (.xml / .xml.gz). */
async function rowsFromFile(file: File): Promise<ListRow[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return rowsFromSheet(await readFirstSheet(bytes));
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  if (!text.includes("<myanimelist")) throw new Error("not a list");
  return rowsFromMalExport(text);
}

/**
 * Import a whole MyAnimeList list in one go: every completed season, as watched. Films, OVAs,
 * specials, recaps and web shorts are left out (listed, with why); seasons of one show land
 * together as a series, the same way the single import does it. Safe to run again — what is
 * already in the library starts unticked, and importing only ever adds.
 */
export default function MalListImport() {
  const [user, setUser] = useState("");
  const [phase, setPhase] = useState<"start" | "finding" | "review" | "importing" | "done">("start");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [missing, setMissing] = useState<ListRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [english, setEnglish] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string }>({ done: 0, total: 0, label: "" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const stop = useRef(false);

  const shown = (e: MalEntry) => (english && e.titleEn ? e.titleEn : e.title);

  function review(found: Item[], skip: Skipped[], notFound: ListRow[]) {
    // One entry once, however many rows led to it.
    const seen = new Set<number>();
    const unique = found.filter((i) => !seen.has(i.entry.id) && seen.add(i.entry.id));
    setItems(unique);
    setSkipped(skip);
    setMissing(notFound);
    setChecked(new Set(unique.filter((i) => i.reason === null && !i.entry.place).map((i) => i.entry.id)));
    setPhase("review");
  }

  async function loadUser(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setPhase("finding");
    setProgress({ done: 0, total: 0, label: "Reading your list from MyAnimeList…" });
    const { ok, data } = await getJson(`/api/anime/mal/list?${new URLSearchParams({ user: user.trim() })}`);
    if (!ok) {
      setError(String(data.error ?? "Couldn't read that list"));
      setPhase("start");
      return;
    }
    const entries = data.entries as Entry[];
    review(entries.map((entry) => ({ entry, reason: leftOutReason(entry) })), [], []);
  }

  async function loadFile(file: File) {
    setError(null);
    let rows: ListRow[];
    try {
      rows = await rowsFromFile(file);
    } catch {
      setError("That file isn't a MyAnimeList list. Use a copy of your list page (.xlsx) or MyAnimeList's export (.xml).");
      return;
    }
    if (rows.length === 0) {
      setError("No anime found in that file.");
      return;
    }
    // Films, OVAs, specials and one-offs are known from the file alone; only possible seasons are
    // looked up — that is where the MyAnimeList entry (and its episode length) is needed.
    const skip: Skipped[] = [];
    const lookUp: ListRow[] = [];
    for (const row of rows) {
      const reason = leftOutReason({ ...row, duration: null });
      if (reason) skip.push({ row, reason });
      else lookUp.push(row);
    }

    setPhase("finding");
    stop.current = false;
    // Each with its place in the list, to keep the list's order however the lookups finish.
    const found: (Item & { at: number })[] = [];
    const notFound: (ListRow & { at: number })[] = [];
    let done = 0;
    let fatal: string | null = null;
    // Three at a time: gentle on MyAnimeList, and a 150-row list still takes about a minute.
    let next = 0;
    async function worker() {
      while (next < lookUp.length && !fatal && !stop.current) {
        const at = next++;
        const row = lookUp[at];
        const { ok, status, data } = await getJson(`/api/anime/mal/search?${new URLSearchParams({ q: searchQuery(row.title) })}`);
        if (!ok && status === 503) fatal = String(data.error ?? "MyAnimeList isn't set up on the site");
        const entry = ok ? pickEntry(row, data.entries as Entry[]) as Entry | null : null;
        if (entry) found.push({ entry, reason: leftOutReason(entry), at });
        else if (!fatal) notFound.push({ ...row, at });
        setProgress({ done: ++done, total: lookUp.length, label: `Finding each one on MyAnimeList — ${done} of ${lookUp.length}` });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (stop.current) {
      setPhase("start");
      return;
    }
    if (fatal) {
      setError(fatal);
      setPhase("start");
      return;
    }
    found.sort((a, b) => a.at - b.at);
    notFound.sort((a, b) => a.at - b.at);
    review(found, skip, notFound);
  }

  function toggle(id: number) {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function importChecked(only?: number[]) {
    const wanted = new Set(only ?? checked);
    const order = items.map((i) => i.entry.id).filter((id) => wanted.has(id));
    if (order.length === 0) return;
    setPhase("importing");
    setError(null);
    stop.current = false;
    const result: Outcome = { added: 0, linked: 0, already: 0, series: 0, problems: [], failed: [] };
    const doneIds = new Set<number>();
    const title = (id: number) => {
      const e = items.find((i) => i.entry.id === id)?.entry;
      return e ? shown(e) : `MyAnimeList entry ${id}`;
    };

    for (const id of order) {
      if (stop.current) break;
      if (doneIds.has(id)) continue;
      setProgress({ done: doneIds.size, total: order.length, label: `Importing ${title(id)}` });

      // Which of the ticked seasons belong with this one: its run of sequels and prequels.
      const run = await getJson(`/api/anime/mal/run?${new URLSearchParams({ id: String(id) })}`);
      if (!run.ok && run.status === 503) {
        // MyAnimeList isn't set up on the site: nothing further can work.
        result.problems.push(String(run.data.error ?? "MyAnimeList isn't set up on the site"));
        result.failed.push(...order.filter((x) => !doneIds.has(x)));
        break;
      }
      const inRun = new Set(run.ok ? (run.data.entries as { id: number }[]).map((e) => e.id) : [id]);
      const group = order.filter((x) => !doneIds.has(x) && (x === id || inRun.has(x)));

      const res = await getJson("/api/anime/mal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universeId: null, malIds: group, watched: true, english }),
      });
      for (const x of group) doneIds.add(x);
      if (!res.ok) {
        // Kept going: the rest still import, and these can be tried again from the result.
        result.problems.push(`${title(id)}: ${String(res.data.error ?? "import failed")}`);
        result.failed.push(...group);
        continue;
      }
      const lines = (res.data.entries ?? []) as { outcome: string; title: string; where?: string }[];
      for (const l of lines) {
        if (l.outcome === "added") result.added++;
        else if (l.outcome === "linked" || l.outcome === "moved") result.linked++;
        else if (l.outcome === "already") result.already++;
        else if (l.outcome === "elsewhere") result.problems.push(`${l.title}: already in ${l.where} — left there`);
      }
      if (res.data.seriesId) result.series++;
      for (const f of (res.data.failed ?? []) as { malId: number; reason: string }[]) {
        result.problems.push(`${title(f.malId)}: ${f.reason}`);
      }
    }
    if (stop.current) {
      result.failed.push(...order.filter((x) => !doneIds.has(x)));
      result.problems.unshift(`Stopped after ${doneIds.size} of ${order.length}.`);
    }
    setProgress({ done: doneIds.size, total: order.length, label: "" });
    setOutcome(result);
    setPhase("done");
  }

  const seasons = items.filter((i) => i.reason === null);
  const leftOut = items.filter((i) => i.reason !== null);
  const groupsOut = new Map<LeftOut, { items: Item[]; rows: ListRow[] }>();
  for (const i of leftOut) {
    const g = groupsOut.get(i.reason!) ?? { items: [], rows: [] };
    g.items.push(i);
    groupsOut.set(i.reason!, g);
  }
  for (const s of skipped) {
    const g = groupsOut.get(s.reason) ?? { items: [], rows: [] };
    g.rows.push(s.row);
    groupsOut.set(s.reason, g);
  }
  const leftOutCount = leftOut.length + skipped.length;

  if (phase === "start") {
    return (
      <div className="space-y-5">
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
          <p className="text-[11px] text-gray-500">Reads your public list&apos;s Completed anime through MyAnimeList&apos;s API.</p>
        </form>
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-gray-500">Or upload your list</span>
          <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-4 text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-50">
            <FileUp className="w-4 h-4" /> Choose a file
            <input type="file" accept=".xlsx,.xml,.gz" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
          </label>
          <p className="text-[11px] text-gray-500">
            A copy of your Completed list page saved as .xlsx, or MyAnimeList&apos;s own export (.xml or .xml.gz,
            from your profile&apos;s Export).
          </p>
        </div>
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
        <MalNotice />
      </div>
    );
  }

  if (phase === "finding" || phase === "importing") {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Loader2 className="w-4 h-4 animate-spin" /> {progress.label || "Working…"}
        </p>
        {progress.total > 0 && (
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
        <p className="text-xs text-gray-500">
          {phase === "importing" ? `${progress.done} of ${progress.total} seasons done. ` : ""}
          Keep this page open — a long list takes a few minutes.
        </p>
        <button type="button" onClick={() => { stop.current = true; }}
          className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50">
          <Square className="w-3 h-3" /> Stop
        </button>
      </div>
    );
  }

  if (phase === "done" && outcome) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">
            {[
              `${outcome.added} added as watched`,
              outcome.series && `in ${outcome.series} series`,
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
          <Link href="/library/anime" className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50">
            <Check className="w-4 h-4" /> See your anime
          </Link>
        </div>
      </div>
    );
  }

  // Review.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-gray-700">
          <strong>{seasons.length}</strong> seasons
          {missing.length > 0 && <> · <strong>{missing.length}</strong> not found</>}
          {" · "}<strong>{leftOutCount}</strong> left out
        </p>
        <div className="w-56"><Toggle label="Titles" value={english} onChange={setEnglish} off="Japanese" on="English" /></div>
      </div>
      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs">
          <span className="font-semibold text-gray-700">Seasons — imported as watched</span>
          <span className="flex gap-3">
            <button type="button" onClick={() => setChecked(new Set([...checked, ...seasons.filter((i) => !i.entry.place).map((i) => i.entry.id)]))}
              className="font-semibold text-gray-600 hover:text-gray-900">All</button>
            <button type="button" onClick={() => setChecked(new Set())} className="font-semibold text-gray-600 hover:text-gray-900">None</button>
          </span>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
          {seasons.map((i) => <Row key={i.entry.id} item={i} name={shown(i.entry)} checked={checked.has(i.entry.id)} onToggle={toggle} />)}
        </ul>
      </section>

      {missing.length > 0 && (
        <details className="border border-gray-200 rounded-lg px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Not found on MyAnimeList ({missing.length}) — add these from Add Anime
          </summary>
          <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-0.5">
            {missing.map((r, n) => <li key={n}>{r.title} <span className="text-gray-400">({MEDIA[r.mediaType] ?? r.mediaType}{r.episodes ? `, ${r.episodes} ep` : ""})</span></li>)}
          </ul>
        </details>
      )}

      {leftOutCount > 0 && (
        <details className="border border-gray-200 rounded-lg px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">Left out ({leftOutCount}) — films, OVAs, specials, recaps, shorts</summary>
          {[...groupsOut.entries()].map(([reason, g]) => (
            <div key={reason} className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{LEFT_OUT_LABELS[reason]} ({g.items.length + g.rows.length})</p>
              <ul className="divide-y divide-gray-100">
                {g.items.map((i) => <Row key={i.entry.id} item={i} name={shown(i.entry)} checked={checked.has(i.entry.id)} onToggle={toggle} />)}
              </ul>
              {g.rows.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">{g.rows.map((r) => r.title).join(" · ")}</p>
              )}
            </div>
          ))}
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { setPhase("start"); setItems([]); }} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
          Start over
        </button>
        <button type="button" onClick={() => importChecked()} disabled={checked.size === 0}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          <Download className="w-4 h-4" /> Import {checked.size} as watched
        </button>
      </div>
      <MalNotice />
    </div>
  );
}

function Row({ item, name, checked, onToggle }: { item: Item; name: string; checked: boolean; onToggle: (id: number) => void }) {
  const e = item.entry;
  return (
    <li>
      <label className="flex items-center gap-3 px-3 py-2 bg-white cursor-pointer hover:bg-gray-50">
        <input type="checkbox" checked={checked} onChange={() => onToggle(e.id)} className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
        <Poster src={e.poster} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-900 truncate">{name}</span>
          <span className="block text-xs text-gray-500">{meta(e)}</span>
        </span>
        {e.place && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
            {e.place.seriesName ? `In ${e.place.seriesName}` : "In your library"}
          </span>
        )}
      </label>
    </li>
  );
}
