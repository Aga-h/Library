import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ArticleForm from "@/components/articles/ArticleForm";
import { db } from "@/lib/db";

export default async function NewArticlePage() {
  const [authorOpts, publicationOpts] = await Promise.all([
    db.article.findMany({ where: { author: { not: null } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author).filter((v): v is string => v !== null && v !== "")),
    db.article.findMany({ where: { publication: { not: null } }, select: { publication: true }, distinct: ["publication"], orderBy: { publication: "asc" } })
      .then(r => r.map(x => x.publication).filter((v): v is string => v !== null && v !== "")),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/articles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Articles
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Article</h1>
        <ArticleForm mode="create" authorOptions={authorOpts} publicationOptions={publicationOpts} />
      </div>
    </div>
  );
}
