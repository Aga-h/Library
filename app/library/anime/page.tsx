export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { AnimeStatus, Language } from "@prisma/client";
import { db } from "@/lib/db";
import AnimeStats from "@/components/anime/AnimeStats";
import AnimeCard from "@/components/anime/AnimeCard";
import AnimeFilters from "@/components/anime/AnimeFilters";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";

interface PageProps { searchParams: Promise<{ status?: string; language?: string; q?: string }> }

export default async function AnimePage({ searchParams }: PageProps) {
  const { status, language, q } = await searchParams;
  const total = await db.anime.count();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anime</h1>
          <p className="text-sm text-gray-500 mt-1">{total} anime in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/anime/mirror-covers" />
          <Link href="/library/anime/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Anime
          </Link>
        </div>
      </div>
      <Suspense><AnimeFilters /></Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <AnimeContent status={status} language={language} q={q} />
      </Suspense>
    </div>
  );
}

async function AnimeContent({ status, language, q }: { status?: string; language?: string; q?: string }) {
  const [all, filteredMaybe] = await Promise.all([
    db.anime.findMany({ orderBy: { createdAt: "desc" } }),
    (status || language || q)
      ? db.anime.findMany({
          where: {
            ...(status   ? { status: status as AnimeStatus } : {}),
            ...(language ? { language: language as Language } : {}),
            ...(q ? { OR: [
              { title:  { contains: q, mode: "insensitive" } },
              { studio: { contains: q, mode: "insensitive" } },
            ]} : {}),
          },
          select: {
            id: true, title: true, studio: true, status: true,
            episodes: true, episodesWatched: true, episodeDuration: true,
            season: true, year: true, language: true,
            coverImage: true, rating: true, timesRewatched: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const filtered = filteredMaybe ?? all;

  return (
    <>
      <AnimeStats anime={all} />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No anime found</p>
          <p className="text-gray-400 text-sm mt-1">{status || language || q ? "Try adjusting your filters." : "Add your first anime to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((anime) => <AnimeCard key={anime.id} anime={anime} />)}
        </div>
      )}
    </>
  );
}
