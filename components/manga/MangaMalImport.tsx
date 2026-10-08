"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Download, Link2, Loader2, Search } from "lucide-react";
import { inputCls } from "@/components/ui/form";
import { MalNotice, Poster } from "@/components/tmdb/TmdbParts";
import { Toggle } from "@/components/anime/MalImport";
import { LANGUAGE_OPTIONS, type LanguageKey } from "@/lib/constants/languages";

interface Place {
  mangaId: string;
  title: string;
  /** false: added by hand under one of the entry's titles. */
  linked: boolean;
}

interface Entry {
  id: number;
  title: string;
  titleEn: string | null;
  year: number | null;
  mediaType: string;
  publishing: string;
  volumes: number | null;
  chapters: number | null;
  writers: string[];
  artists: string[];
  cover: string | null;
  place: Place | null;
}

const MEDIA: Record<string, string> = {
  manga: "Manga", manhwa: "Manhwa", manhua: "Manhua", one_shot: "One-shot", doujinshi: "Doujinshi",
  oel: "OEL manga", light_novel: "Light novel", novel: "Novel",
};

const PUBLISHING: Record<string, string> = {
  currently_publishing: "publishing", on_hiatus: "on hiatus", not_yet_published: "not out yet",
  discontinued: "discontinued",
};

const NOVELS = new Set(["light_novel", "novel"]);

function meta(e: Entry): string {
  return [
    MEDIA[e.mediaType] ?? null,
    e.year,
    e.volumes ? `${e.volumes} vol` : null,
    e.chapters ? `${e.chapters} ch` : null,
    PUBLISHING[e.publishing] ?? null,
  ].filter(Boolean).join(" · ");
}

function credits(e: Entry): string {
  const art = e.artists.filter((a) => !e.writers.includes(a));
  return [e.writers.join(", "), art.length ? `art ${art.join(", ")}` : ""].filter(Boolean).join(" · ");
}

/**
 * Find a manga on MyAnimeList and add it — author, artist, volume and chapter counts and cover
 * come with it. One already in the library is opened, never added twice; one you added by hand
 * under the same title is linked instead. With `link`, picking an entry links that manga.
 * Search runs on submit, not on every keystroke.
 */
export default function MangaMalImport({
  defaultLanguage,
  link,
}: {
  defaultLanguage: LanguageKey;
  link?: { mangaId: string; title: string };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(link?.title ?? "");
  const [results, setResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState(false);
  const [english, setEnglish] = useState(true);
  const [language, setLanguage] = useState<LanguageKey>(defaultLanguage);
  const [busy, setBusy] = useState<number | null>(null);

  const shown = (e: Entry) => (english && e.titleEn ? e.titleEn : e.title);

  async function runSearch(ev: React.FormEvent) {
    ev.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    setError(null);
    const res = await fetch(`/api/manga/mal/search?${new URLSearchParams({ q: query.trim() })}`);
    const data = await res.json().catch(() => ({}));
    setSearching(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed");
      setResults(null);
      return;
    }
    setResults(data.entries);
  }

  async function pick(e: Entry) {
    setBusy(e.id);
    setError(null);
    const res = await fetch("/api/manga/mal/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ malId: e.id, read, english, language, ...(link ? { mangaId: link.mangaId } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(null);
      setError(data.error ?? (link ? "Couldn't link it" : "Import failed"));
      return;
    }
    if (!link) router.push(`/library/manga/${data.mangaId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!link && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Toggle label="Mark it" value={read} onChange={setRead} off="To read" on="Read" />
            <Toggle label="Title" value={english} onChange={setEnglish} off="Japanese" on="English" />
            <div>
              <label htmlFor="mal-language" className="block text-xs font-semibold text-gray-500 mb-1">Reading it in</label>
              <select id="mal-language" value={language} onChange={(ev) => setLanguage(ev.target.value as LanguageKey)} className={inputCls}>
                {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {read && <p className="text-[11px] text-gray-500 -mt-2">A finished series counts as fully read; one still publishing starts at 0 — set your chapter on its Edit page.</p>}
        </>
      )}

      <form onSubmit={runSearch} className="flex gap-2">
        <label htmlFor="mal-manga-query" className="sr-only">Search MyAnimeList</label>
        <input id="mal-manga-query" type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} autoFocus={!link}
          placeholder="e.g. Berserk" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={searching || query.trim().length < 3} autoFocus={!!link}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
        </button>
      </form>

      {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {results && (results.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing on MyAnimeList matches that. Try fewer words.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {results.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 bg-white">
              <Poster src={e.cover} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{shown(e)}</p>
                {credits(e) && <p className="text-xs text-gray-600 truncate">{credits(e)}</p>}
                <p className="text-xs text-gray-500">{meta(e)}</p>
              </div>
              <Action entry={e} name={shown(e)} link={link} busy={busy} onPick={pick} />
            </li>
          ))}
        </ul>
      ))}

      <MalNotice kind="Manga" />
    </div>
  );
}

const pillCls = "flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0";
const buttonCls = "flex items-center gap-1.5 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0";

/** What can be done with one result, given where it already is. */
function Action({ entry: e, name, link, busy, onPick }: {
  entry: Entry;
  name: string;
  link?: { mangaId: string; title: string };
  busy: number | null;
  onPick: (e: Entry) => void;
}) {
  if (NOVELS.has(e.mediaType)) {
    return <span className={`${pillCls} bg-gray-100 text-gray-500`} title="Light novels and novels go under Books">A novel — Books</span>;
  }
  const place = e.place;
  if (link) {
    if (place?.linked && place.mangaId !== link.mangaId) {
      return (
        <Link href={`/library/manga/${place.mangaId}`} className={`${pillCls} bg-gray-100 text-gray-600 hover:bg-gray-200`}>
          <Check className="w-3 h-3" /> Already {place.title}
        </Link>
      );
    }
  } else if (place?.linked) {
    return (
      <Link href={`/library/manga/${place.mangaId}`} className={`${pillCls} bg-gray-100 text-gray-600 hover:bg-gray-200`}>
        <Check className="w-3 h-3" /> In your library
      </Link>
    );
  }
  // Not linked anywhere: add it, or link it to the one you added by hand.
  const linking = !!link || !!place;
  const label = linking ? (link ? "Link" : "Link yours") : "Add";
  return (
    <button type="button" onClick={() => onPick(e)} disabled={busy !== null} aria-label={`${label}: ${name}`}
      title={place && !link ? `Links "${place.title}", which you added by hand` : undefined}
      className={buttonCls}>
      {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : linking ? <Link2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
