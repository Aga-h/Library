export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import ArticleStats from "@/components/articles/ArticleStats";
import ArticleCard from "@/components/articles/ArticleCard";
import ArticleFilters from "@/components/articles/ArticleFilters";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { ARTICLE_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";

interface PageProps { searchParams: Promise<{ status?: string; language?: string; q?: string }> }

export default async function ArticlesPage({ searchParams }: PageProps) {
  const { status, language, q } = await searchParams;
  const total = await db.article.count();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="text-sm text-gray-500 mt-1">{total} articles in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/articles/mirror-covers" />
          <Link href="/library/articles/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Article
          </Link>
        </div>
      </div>
      <Suspense><ArticleFilters /></Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <ArticleContent status={status} language={language} q={q} />
      </Suspense>
    </div>
  );
}

async function ArticleContent({ status, language, q }: { status?: string; language?: string; q?: string }) {
  const [statsRows, filtered] = await Promise.all([
    // Stats-only projection: fetching every column pulled unbounded `notes` for every
    // row just to compute a handful of counters.
    db.article.findMany({ select: { status: true, wordCount: true, language: true, timesReread: true }, orderBy: { createdAt: "desc" } }),
    db.article.findMany({
      where: {
        ...(asEnum(status, ARTICLE_STATUS_VALUES) ? { status: asEnum(status, ARTICLE_STATUS_VALUES) } : {}),
        ...(asEnum(language, LANGUAGE_VALUES) ? { language: asEnum(language, LANGUAGE_VALUES) } : {}),
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
    }),
  ]);

  return (
    <>
      <ArticleStats articles={statsRows} />
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
    </>
  );
}
