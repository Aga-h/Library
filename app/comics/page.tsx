export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import ComicStats from "@/components/comics/ComicStats";
import ComicCard from "@/components/comics/ComicCard";
import ComicFilters from "@/components/comics/ComicFilters";

type Comic = Awaited<ReturnType<typeof db.comic.findMany>>[number];

interface PageProps { searchParams: Promise<{ status?: string; language?: string }> }

export default async function ComicsPage({ searchParams }: PageProps) {
  const { status, language } = await searchParams;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (language) where.language = language;

  const [all, filtered] = await Promise.all([
    db.comic.findMany({ orderBy: { createdAt: "desc" } }),
    db.comic.findMany({ where, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comics</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} comics in your library</p>
        </div>
        <Link href="/comics/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Comic
        </Link>
      </div>
      <ComicStats comics={all} />
      <Suspense><ComicFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No comics found</p>
          <p className="text-gray-400 text-sm mt-1">{status || language ? "Try adjusting your filters." : "Add your first comic to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((comic: Comic) => <ComicCard key={comic.id} comic={comic} />)}
        </div>
      )}
    </div>
  );
}
