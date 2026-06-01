export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import ComicForm from "@/components/comics/ComicForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditComicPage({ params }: PageProps) {
  const { id } = await params;
  const [comic, authorOpts, artistOpts, publisherOpts, universeOpts] = await Promise.all([
    db.comic.findUnique({ where: { id } }),
    db.comic.findMany({ where: { author: { not: null } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author).filter((v): v is string => v !== null && v !== "")),
    db.comic.findMany({ where: { artist: { not: null } }, select: { artist: true }, distinct: ["artist"], orderBy: { artist: "asc" } })
      .then(r => r.map(x => x.artist).filter((v): v is string => v !== null && v !== "")),
    db.comic.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
    db.comic.findMany({ where: { universe: { not: null } }, select: { universe: true }, distinct: ["universe"], orderBy: { universe: "asc" } })
      .then(r => r.map(x => x.universe).filter((v): v is string => v !== null && v !== "")),
  ]);
  if (!comic) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/comics/${comic.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Comic
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Comic</h1>
        <p className="text-sm text-gray-500 mb-6">{comic.title}</p>
        <ComicForm mode="edit" authorOptions={authorOpts} artistOptions={artistOpts} publisherOptions={publisherOpts} universeOptions={universeOpts} initialData={{
          id: comic.id, title: comic.title,
          author: comic.author ?? "", artist: comic.artist ?? "",
          publisher: comic.publisher ?? "", universe: comic.universe ?? "",
          status: comic.status,
          totalIssues: comic.totalIssues?.toString() ?? "",
          issuesRead: comic.issuesRead.toString(),
          language: comic.language,
          coverImage: comic.coverImage ?? "", rating: comic.rating?.toString() ?? "",
          timesReread: comic.timesReread.toString(),
          notes: comic.notes ?? "",
        }} />
      </div>
    </div>
  );
}
