export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MangaForm from "@/components/manga/MangaForm";
import MangaMalImport from "@/components/manga/MangaMalImport";
import { db } from "@/lib/db";
import type { LanguageKey } from "@/lib/constants/languages";

export default async function NewMangaPage() {
  const [authorOpts, artistOpts, publisherOpts, usual] = await Promise.all([
    db.manga.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.manga.findMany({ where: { artist: { not: null } }, select: { artist: true }, distinct: ["artist"], orderBy: { artist: "asc" } })
      .then(r => r.map(x => x.artist).filter((v): v is string => v !== null && v !== "")),
    db.manga.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
    // The language most of the library is read in — what an import starts on.
    db.manga.groupBy({ by: ["language"], _count: { language: true }, orderBy: { _count: { language: "desc" } }, take: 1 })
      .then(r => (r[0]?.language ?? "JAPANESE") as LanguageKey),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/manga" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Manga</h1>
        <p className="text-sm text-gray-500 mb-6">
          Search MyAnimeList — the series comes in with its author, artist, volume and chapter counts
          and cover.
        </p>
        <MangaMalImport defaultLanguage={usual} />
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6">Or add one by hand</h2>
        <MangaForm mode="create" authorOptions={authorOpts} artistOptions={artistOpts} publisherOptions={publisherOpts} />
      </div>
    </div>
  );
}
