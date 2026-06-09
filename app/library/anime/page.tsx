export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { AnimeStatus } from "@prisma/client";
import { db } from "@/lib/db";
import AnimeStats from "@/components/anime/AnimeStats";
import AnimeGroupedView from "@/components/anime/AnimeGroupedView";
import AnimeSeriesManager from "@/components/anime/AnimeSeriesManager";
import AnimeFilters from "@/components/anime/AnimeFilters";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";


interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AnimePage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;

  const [all, filteredMaybe] = await Promise.all([
    db.anime.findMany({ orderBy: { createdAt: "desc" } }),
    (status || q)
      ? db.anime.findMany({
          where: {
            ...(status ? { status: status as AnimeStatus } : {}),
            ...(q ? { OR: [
              { title:  { contains: q, mode: "insensitive" } },
              { studio: { contains: q, mode: "insensitive" } },
            ]} : {}),
          },
          select: {
            id: true, title: true, studio: true, status: true, episodes: true,
            episodesWatched: true, episodeDuration: true, season: true, year: true,
            language: true, coverImage: true, rating: true, timesRewatched: true,
            seriesName: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const filteredAnime = filteredMaybe ?? all;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anime</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} anime in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimeSeriesManager allItems={all.map(a => ({ id: a.id, title: a.title, coverImage: a.coverImage, seriesName: a.seriesName }))} />
          <MirrorCoversButton apiPath="/api/anime/mirror-covers" />
          <Link href="/library/anime/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Anime
          </Link>
        </div>
      </div>

      <AnimeStats anime={all} />

      <Suspense><AnimeFilters /></Suspense>

      <AnimeGroupedView items={filteredAnime} hasFilter={!!(status || q)} />
    </div>
  );
}
