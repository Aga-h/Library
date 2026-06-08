export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ArticleStatus, Language } from "@prisma/client";
import { db } from "@/lib/db";
import ArticleStats from "@/components/articles/ArticleStats";
import ArticleCard from "@/components/articles/ArticleCard";
import ArticleFilters from "@/components/articles/ArticleFilters";

interface PageProps { searchParams: Promise<{ status?: string; language?: string; q?: string }> }

export default async function ArticlesPage({ searchParams }: PageProps) {
  const { status, language, q } = await searchParams;

  const [all, filteredMaybe] = await Promise.all([
    db.article.findMany({ orderBy: { createdAt: "desc" } }),
    (status || language || q)
      ? db.article.findMany({
          where: {
            ...(status   ? { status: status as ArticleStatus } : {}),
            ...(language ? { language: language as Language } : {}),
            ...(q ? { OR: [
              { title:       { contains: q, mode: "insensitive" } },
              { author:      { contains: q, mode: "insensitive" } },
              { publication: { contains: q, mode: "insensitive" } },
            ]} : {}),
          },
          select: {
            id: true, title: true, author: true, publication: true, url: true,
            status: true, wordCount: true, language: true,
            coverImage: true, rating: true, timesReread: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const filtered = filteredMaybe ?? all;

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
          <p className="text-gray-400 text-sm mt-1">{status || language || q ? "Try adjusting your filters." : "Add your first article to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((article) => <ArticleCard key={article.id} article={article} />)}
        </div>
      )}
    </div>
  );
}
