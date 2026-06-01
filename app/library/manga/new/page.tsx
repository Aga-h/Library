import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MangaForm from "@/components/manga/MangaForm";
import { db } from "@/lib/db";

export default async function NewMangaPage() {
  const [authorOpts, artistOpts, publisherOpts] = await Promise.all([
    db.manga.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.manga.findMany({ where: { artist: { not: null } }, select: { artist: true }, distinct: ["artist"], orderBy: { artist: "asc" } })
      .then(r => r.map(x => x.artist).filter((v): v is string => v !== null && v !== "")),
    db.manga.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/manga" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Manga</h1>
        <MangaForm mode="create" authorOptions={authorOpts} artistOptions={artistOpts} publisherOptions={publisherOpts} />
      </div>
    </div>
  );
}
