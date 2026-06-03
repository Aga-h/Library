export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import AnimeStats from "@/components/anime/AnimeStats";
import AnimeGroupedView from "@/components/anime/AnimeGroupedView";
import AnimeSeriesManager from "@/components/anime/AnimeSeriesManager";
import AnimeFilters from "@/components/anime/AnimeFilters";


interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AnimePage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;

  const allAnime = await db.anime.findMany({ orderBy: { createdAt: "desc" } });
  const ql = q?.toLowerCase();
  const filteredAnime = allAnime.filter(a =>
    (!status || a.status === status) &&
    (!ql || a.title.toLowerCase().includes(ql) || a.studio?.toLowerCase().includes(ql))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anime</h1>
          <p className="text-sm text-gray-500 mt-1">{allAnime.length} anime in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimeSeriesManager allItems={allAnime.map(a => ({ id: a.id, title: a.title, coverImage: a.coverImage, seriesName: a.seriesName }))} />
          <Link href="/library/anime/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Anime
          </Link>
        </div>
      </div>

      <AnimeStats anime={allAnime} />

      <Suspense><AnimeFilters /></Suspense>

      <AnimeGroupedView items={filteredAnime} hasFilter={!!(status || q)} />
    </div>
  );
}
