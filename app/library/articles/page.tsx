export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import ArticleStats from "@/components/articles/ArticleStats";
import ArticleCard from "@/components/articles/ArticleCard";
import ArticleFilters from "@/components/articles/ArticleFilters";

type Article = Awaited<ReturnType<typeof db.article.findMany>>[number];

interface PageProps { searchParams: Promise<{ status?: string; language?: string }> }

export default async function ArticlesPage({ searchParams }: PageProps) {
  const { status, language } = await searchParams;
  const all = await db.article.findMany({ orderBy: { createdAt: "desc" } });
  const filtered = all.filter(a => (!status || a.status === status) && (!language || a.language === language));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} articles in your library</p>
        </div>
        <Link href="/library/articles/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Article
        </Link>
      </div>
      <ArticleStats articles={all} />
      <Suspense><ArticleFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No articles found</p>
          <p className="text-gray-400 text-sm mt-1">{status || language ? "Try adjusting your filters." : "Add your first article to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((article: Article) => <ArticleCard key={article.id} article={article} />)}
        </div>
      )}
    </div>
  );
}
