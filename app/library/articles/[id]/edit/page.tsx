export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import ArticleForm from "@/components/articles/ArticleForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditArticlePage({ params }: PageProps) {
  const { id } = await params;
  const [article, authorOpts, publicationOpts] = await Promise.all([
    db.article.findUnique({ where: { id } }),
    db.article.findMany({ where: { author: { not: null } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author).filter((v): v is string => v !== null && v !== "")),
    db.article.findMany({ where: { publication: { not: null } }, select: { publication: true }, distinct: ["publication"], orderBy: { publication: "asc" } })
      .then(r => r.map(x => x.publication).filter((v): v is string => v !== null && v !== "")),
  ]);
  if (!article) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/articles/${article.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Article
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Article</h1>
        <p className="text-sm text-gray-500 mb-6">{article.title}</p>
        <ArticleForm mode="edit" authorOptions={authorOpts} publicationOptions={publicationOpts} initialData={{
          id: article.id, title: article.title,
          author: article.author ?? "", publication: article.publication ?? "",
          url: article.url ?? "", status: article.status,
          wordCount: article.wordCount.toString(),
          language: article.language,
          coverImage: article.coverImage ?? "", rating: article.rating?.toString() ?? "",
          timesReread: article.timesReread.toString(),
          notes: article.notes ?? "",
        }} />
      </div>
    </div>
  );
}
