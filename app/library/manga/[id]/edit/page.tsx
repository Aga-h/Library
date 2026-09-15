export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import MangaForm from "@/components/manga/MangaForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditMangaPage({ params }: PageProps) {
  const { id } = await params;
  const [manga, authorOpts, artistOpts, publisherOpts] = await Promise.all([
    db.manga.findUnique({ where: { id } }),
    db.manga.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.manga.findMany({ where: { artist: { not: null } }, select: { artist: true }, distinct: ["artist"], orderBy: { artist: "asc" } })
      .then(r => r.map(x => x.artist).filter((v): v is string => v !== null && v !== "")),
    db.manga.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
  ]);
  if (!manga) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/manga/${manga.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Manga</h1>
        <p className="text-sm text-gray-500 mb-6">{manga.title}</p>
        <MangaForm mode="edit" authorOptions={authorOpts} artistOptions={artistOpts} publisherOptions={publisherOpts} initialData={{
          id: manga.id, title: manga.title, author: manga.author,
          artist: manga.artist ?? "", publisher: manga.publisher ?? "",
          format: manga.format,
          totalVolumes: manga.totalVolumes?.toString() ?? "",
          volumesRead: manga.volumesRead.toString(),
          totalChapters: manga.totalChapters?.toString() ?? "",
          chaptersRead: manga.chaptersRead.toString(),
            ongoing: manga.ongoing,
          language: manga.language,
          coverImage: manga.coverImage ?? "", rating: manga.rating?.toString() ?? "",
          timesReread: manga.timesReread.toString(),
          notes: manga.notes ?? "",
        }} />
      </div>
    </div>
  );
}
