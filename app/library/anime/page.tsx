export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import AnimeStats from "@/components/anime/AnimeStats";
import AnimeCard from "@/components/anime/AnimeCard";
import AnimeFilters from "@/components/anime/AnimeFilters";

type Anime = Awaited<ReturnType<typeof db.anime.findMany>>[number];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AnimePage({ searchParams }: PageProps) {
  const { status } = await searchParams;

  const allAnime = await db.anime.findMany({ orderBy: { createdAt: "desc" } });
  const filteredAnime = allAnime.filter(a => !status || a.status === status);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anime</h1>
          <p className="text-sm text-gray-500 mt-1">{allAnime.length} anime in your library</p>
        </div>
        <Link href="/library/anime/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Anime
        </Link>
      </div>

      <AnimeStats anime={allAnime} />

      <Suspense><AnimeFilters /></Suspense>

      {filteredAnime.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No anime found</p>
          <p className="text-gray-400 text-sm mt-1">{status ? "Try adjusting your filters." : "Add your first anime to get started."}</p>
          {!status && (
            <Link href="/library/anime/new" className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
              <Plus className="w-4 h-4" /> Add Anime
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAnime.map((anime: Anime) => <AnimeCard key={anime.id} anime={anime} />)}
        </div>
      )}
    </div>
  );
}
