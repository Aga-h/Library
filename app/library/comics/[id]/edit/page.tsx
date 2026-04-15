export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import ComicForm from "@/components/comics/ComicForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditComicPage({ params }: PageProps) {
  const { id } = await params;
  const comic = await db.comic.findUnique({ where: { id } });
  if (!comic) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/comics/${comic.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Comic
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Comic</h1>
        <p className="text-sm text-gray-500 mb-6">{comic.title}</p>
        <ComicForm mode="edit" initialData={{
          id: comic.id, title: comic.title,
          author: comic.author ?? "", artist: comic.artist ?? "",
          publisher: comic.publisher ?? "", universe: comic.universe ?? "",
          status: comic.status,
          totalIssues: comic.totalIssues?.toString() ?? "",
          issuesRead: comic.issuesRead.toString(),
          language: comic.language,
          coverImage: comic.coverImage ?? "", rating: comic.rating?.toString() ?? "",
          notes: comic.notes ?? "",
        }} />
      </div>
    </div>
  );
}
