export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MangaListImport from "@/components/manga/MangaListImport";
import { db } from "@/lib/db";
import type { LanguageKey } from "@/lib/constants/languages";

export default async function ImportMangaListPage() {
  // The language most of the library is read in — what the import starts on, as Add Manga does.
  const usual = await db.manga.groupBy({ by: ["language"], _count: { language: true }, orderBy: { _count: { language: "desc" } }, take: 1 })
    .then((r) => (r[0]?.language ?? "JAPANESE") as LanguageKey);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/manga" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Import a MyAnimeList list</h1>
        <p className="text-sm text-gray-500 mb-6">
          What you finished comes in as read and what you&apos;re reading at your chapter, each with its
          author, artist, volume and chapter counts and cover. Light novels and novels are left out — they
          go under Books. Running it again only adds what&apos;s new.
        </p>
        <MangaListImport defaultLanguage={usual} />
      </div>
    </div>
  );
}
