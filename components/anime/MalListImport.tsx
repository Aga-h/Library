"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, FileUp, Loader2, User } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MalNotice, Poster } from "@/components/tmdb/TmdbParts";
import { Toggle } from "@/components/anime/MalImport";
import type { MalEntry } from "@/lib/mal";
import {
  bridgeIds, groupSeries, leftOutByEntry, leftOutByList, rowsFromMalXml, rowsFromSheet, type ListRow,
} from "@/lib/mal-list";
import { gunzip, readFirstSheet } from "@/lib/xlsx-lite";

/** Must match MAX_RUN in lib/mal-service.ts — the import route takes at most this many. */
const MAX_PER_IMPORT = 40;
const LOOKUP_BATCH = 15;
const BRIDGE_BATCH = 30;

interface Place { animeId: string; seriesId: string | null; seriesName: string | null }

interface Found {
  row: ListRow;
  entry: MalEntry;
  guessed: boolean;
  place: Place | null;
  /** Why it is not a season, from MyAnimeList's details; null when it is one. */
  leftOut: string | null;
}

interface Checked {
  found: Found[];
  bridges: MalEntry[];
  /** Lines never asked about (films and the like) or not found, with why. */
  skipped: { row: ListRow; reason: string }[];
}

interface Totals { series: number; added: number; linked: number; already: number; failed: string[] }

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** POSTs JSON, waiting and retrying when MyAnimeList is rate-limiting (429). */
async function post<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
      continue;
    }
    throw new Error(data.error ?? `The site answered ${res.status}.`);
  }
}

async function rowsFromFile(file: File): Promise<ListRow[]> {
  let bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".gz")) bytes = new Uint8Array(await gunzip(bytes));
  if (name.endsWith(".xlsx")) return rowsFromSheet(await readFirstSheet(bytes));
  if (name.endsWith(".xml") || name.endsWith(".xml.gz")) return rowsFromMalXml(new TextDecoder().decode(bytes));
  throw new Error("Pick an .xlsx file, or MyAnimeList's export (.xml or .xml.gz).");
}

/**
 * Log a whole MyAnimeList list at once, as watched: only complete seasons (TV and web series) go
 * in — films, OVAs, specials, recaps, shorts and anything unfinished are listed as left out —
 * grouped into series by MyAnimeList's sequel links. Each series goes through the ordinary import,
 * so running it again only adds what is new.
 */
export default function MalListImport() {
  const router = useRouter();
  const [source, setSource] = useState<"file" | "user">("file");
  const [user, setUser] = useState("");
  const [english, setEnglish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [totals, setTotals] = useState<Totals | null>(null);

  const busy = progress !== null;
  const shown = (e: MalEntry) => (english && e.titleEn ? e.titleEn : e.title);

  async function check(rows: ListRow[]) {
    const skipped: Checked["skipped"] = [];
    const ask: ListRow[] = [];
    for (const row of rows) {
      const why = leftOutByList(row);
      if (why) skipped.push({ row, reason: why });
      else ask.push(row);
    }

    const found: Found[] = [];
    for (let i = 0; i < ask.length; i += LOOKUP_BATCH) {
      setProgress(`Checking with MyAnimeList… ${Math.min(i + LOOKUP_BATCH, ask.length)} of ${ask.length}`);
      const batch = ask.slice(i, i + LOOKUP_BATCH);
      const data = await post<{
        found: { key: string; entry: MalEntry; guessed: boolean; place: Place | null }[];
        missing: { key: string; reason: string }[];
      }>("/api/anime/mal/lookup", { rows: batch });
      const byKey = new Map(batch.map((r) => [r.key, r]));
      for (const f of data.found) {
        const row = byKey.get(f.key)!;
        found.push({ ...f, row, leftOut: leftOutByEntry(f.entry, row) });
      }
      for (const m of data.missing) skipped.push({ row: byKey.get(m.key)!, reason: m.reason });
    }

    // One step along each season's links, to join seasons with a film or OVA between them.
    const have = new Set(found.map((f) => f.entry.id));
    const links = bridgeIds(found.map((f) => f.entry), have);
    const bridges: MalEntry[] = [];
    for (let i = 0; i < links.length; i += BRIDGE_BATCH) {
      setProgress(`Working out which seasons belong together… ${Math.min(i + BRIDGE_BATCH, links.length)} of ${links.length}`);
      const data = await post<{ bridges: MalEntry[] }>("/api/anime/mal/lookup", { rows: [], ids: links.slice(i, i + BRIDGE_BATCH) });
      bridges.push(...data.bridges);
    }

    setChecked({ found, bridges, skipped });
    setSelected(new Set(found.filter((f) => !f.leftOut && !f.place).map((f) => f.entry.id)));
  }

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setTotals(null);
    setChecked(null);
    try {
      let rows: ListRow[];
      if (source === "user") {
        setProgress("Reading the list…");
        const res = await fetch(`/api/anime/mal/list?${new URLSearchParams({ user: user.trim() })}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't read that list.");
        rows = data.rows;
      } else {
        const file = (e.currentTarget.elements.namedItem("list-file") as HTMLInputElement).files?.[0];
        if (!file) throw new Error("Pick a file first.");
        setProgress("Reading the file…");
        rows = await rowsFromFile(file);
      }
      if (rows.length === 0) throw new Error("That list is empty.");
      await check(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }

  // The series the ticked seasons make, recomputed as ticks change.
  const groups = useMemo(() => {
    if (!checked) return [];
    const ticked = checked.found.filter((f) => selected.has(f.entry.id) || (f.place && !f.leftOut)).map((f) => f.entry);
    const others = [...checked.bridges, ...checked.found.filter((f) => !ticked.includes(f.entry)).map((f) => f.entry)];
    return groupSeries(ticked, others);
  }, [checked, selected]);
  const foundById = useMemo(() => new Map(checked?.found.map((f) => [f.entry.id, f]) ?? []), [checked]);
  const toImport = groups.filter((g) => g.some((e) => selected.has(e.id)));

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importAll() {
    setError(null);
    const sum: Totals = { series: 0, added: 0, linked: 0, already: 0, failed: [] };
    try {
      for (let i = 0; i < toImport.length; i++) {
        setProgress(`Importing series ${i + 1} of ${toImport.length}…`);
        // Seasons already in the library go along, so new ones join their series.
        const ids = toImport[i].map((e) => e.id).filter((id) => selected.has(id) || foundById.get(id)?.place);
        // A run longer than one import takes: each next part starts with the last season of the
        // one before, which puts it in the same series.
        for (let at = 0; at < ids.length; at += MAX_PER_IMPORT - 1) {
          const part = ids.slice(Math.max(0, at - 1), at + MAX_PER_IMPORT - 1);
          if (at > 0 && part.length < 2) break;
          const done = await post<{
            entries: { malId: number; outcome: string }[];
            failed: { malId: number; reason: string }[];
          }>("/api/anime/mal/import", { universeId: null, malIds: part, watched: true, english });
          for (const line of done.entries) {
            if (at > 0 && line.malId === part[0]) continue;
            if (line.outcome === "added") sum.added++;
            else if (line.outcome === "linked" || line.outcome === "moved") sum.linked++;
            else sum.already++;
          }
          for (const f of done.failed) {
            const e = foundById.get(f.malId)?.entry;
            sum.failed.push(`${e ? shown(e) : `MyAnimeList ${f.malId}`} — ${f.reason}`);
          }
        }
        sum.series++;
      }
      setChecked(null);
      router.refresh();
    } catch (err) {
      setError(`${err instanceof Error ? err.message : String(err)} Everything before this point was imported; running it again picks up where it stopped.`);
    } finally {
      setTotals(sum);
      setProgress(null);
    }
  }

  const leftOut = checked
    ? [
        ...checked.found.filter((f) => f.leftOut).map((f) => ({ key: f.row.key, title: shown(f.entry), reason: f.leftOut!, id: f.entry.id })),
        ...checked.skipped.map((s) => ({ key: s.row.key, title: s.row.title, reason: s.reason, id: null })),
      ]
    : [];

  return (
    <div className="space-y-4">
      {!checked && (
        <form onSubmit={start} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Toggle label="Read from" value={source === "user"} onChange={(v) => setSource(v ? "user" : "file")} off="A file" on="Username" />
            <Toggle label="Titles" value={english} onChange={setEnglish} off="Japanese" on="English" />
          </div>
          {source === "file" ? (
            <div>
              <label htmlFor="list-file" className="block text-xs font-semibold text-gray-500 mb-1">List file</label>
              <input key="file" id="list-file" name="list-file" type="file" accept=".xlsx,.xml,.gz" className={inputCls} />
              <p className="text-[11px] text-gray-500 mt-1">
                A spreadsheet copy of your MyAnimeList list page (.xlsx — the title links give each anime&apos;s id),
                or MyAnimeList&apos;s own export (.xml or .xml.gz, from myanimelist.net/panel.php?go=export).
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="list-user" className="block text-xs font-semibold text-gray-500 mb-1">MyAnimeList username</label>
              <input key="user" id="list-user" value={user} onChange={(e) => setUser(e.target.value)} className={inputCls} autoComplete="off" />
              <p className="text-[11px] text-gray-500 mt-1">Your Completed list is read. It has to be public.</p>
            </div>
          )}
          <button type="submit" disabled={busy || (source === "user" && user.trim().length < 2)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : source === "user" ? <User className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}
            Read the list
          </button>
        </form>
      )}

      {progress && <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> {progress}</p>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {totals && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-900 space-y-1">
          <p>
            {plural(totals.series, "series", "series")} imported —{" "}
            {[
              totals.added && `${plural(totals.added, "season")} added as watched`,
              totals.linked && `${totals.linked} matched to ones you had`,
              totals.already && `${totals.already} already there`,
            ].filter(Boolean).join(" · ") || "nothing new"}.{" "}
            <Link href="/library/anime" className="font-semibold underline">See your anime</Link>
          </p>
          {totals.failed.length > 0 && (
            <ul className="text-xs text-emerald-800 list-disc pl-5">{totals.failed.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
        </div>
      )}

      {checked && (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-xs">
              <span className="text-gray-600 font-semibold">
                {plural(selected.size, "season")} to add, in {plural(toImport.length, "series", "series")}
              </span>
              <span className="flex gap-3">
                <button type="button" onClick={() => setSelected(new Set(checked.found.filter((f) => !f.leftOut && !f.place).map((f) => f.entry.id)))}
                  className="font-semibold text-gray-600 hover:text-gray-900">Reset</button>
                <button type="button" onClick={() => setSelected(new Set())} className="font-semibold text-gray-600 hover:text-gray-900">None</button>
              </span>
            </div>
            <ul className="divide-y divide-gray-200 max-h-[36rem] overflow-y-auto">
              {groups.map((group) => (
                <li key={group[0].id} className="py-1">
                  <p className="px-3 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 truncate">
                    {group.length > 1 ? `${shown(group[0])} · ${plural(group.length, "season")}` : "On its own"}
                  </p>
                  {group.map((e) => <Line key={e.id} f={foundById.get(e.id)!} title={shown(e)} selected={selected} toggle={toggle} />)}
                </li>
              ))}
            </ul>
            <div className="px-3 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                Each series is imported with every episode watched. Seasons you already have keep what you set.
              </p>
              <button type="button" onClick={importAll} disabled={busy || selected.size === 0}
                className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Import {plural(selected.size, "season")}
              </button>
            </div>
          </div>

          {leftOut.length > 0 && (
            <details className="border border-gray-200 rounded-lg overflow-hidden">
              <summary className="px-3 py-2.5 bg-gray-50 text-xs font-semibold text-gray-600 cursor-pointer">
                Left out: {plural(leftOut.length, "entry", "entries")} — films, OVAs, specials, recaps, shorts, unfinished
              </summary>
              <ul className="divide-y divide-gray-100 max-h-[24rem] overflow-y-auto">
                {leftOut.map((l) => (
                  <li key={l.key}>
                    <label className={`flex items-center gap-3 px-3 py-2 text-sm ${l.id ? "cursor-pointer hover:bg-gray-50" : ""}`}>
                      {l.id
                        ? <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id!)} className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />
                        : <span className="w-4 flex-shrink-0" />}
                      <span className="flex-1 min-w-0 truncate text-gray-800">{l.title}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{l.reason}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100">
                Tick one to add it after all. Films and the like aren&apos;t asked about at all — add those from Add Anime.
              </p>
            </details>
          )}
        </>
      )}

      <MalNotice />
    </div>
  );
}

function Line({ f, title, selected, toggle }: {
  f: Found; title: string; selected: Set<number>; toggle: (id: number) => void;
}) {
  const e = f.entry;
  return (
    <label className="flex items-center gap-3 px-3 py-1.5 cursor-pointer hover:bg-gray-50">
      {f.place
        ? <span className="w-4 flex-shrink-0" />
        : <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="w-4 h-4 rounded border-gray-300 flex-shrink-0" />}
      <Poster src={e.poster} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-900 truncate">{title}</span>
        <span className="block text-xs text-gray-500">
          {[e.mediaType === "ona" ? "ONA" : "TV", e.year, e.episodes && `${e.episodes} ep`, e.duration && `${e.duration} min`].filter(Boolean).join(" · ")}
          {f.guessed && ` · your list says “${f.row.title}”`}
        </span>
      </span>
      {f.place && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">In your library</span>}
    </label>
  );
}
