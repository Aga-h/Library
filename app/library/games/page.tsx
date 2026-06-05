export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import GameStats from "@/components/games/GameStats";
import GameCard from "@/components/games/GameCard";
import GameFilters from "@/components/games/GameFilters";
import SteamSyncButton from "@/components/games/SteamSyncButton";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";

interface PageProps { searchParams: Promise<{ status?: string; platform?: string; q?: string }> }

export default async function GamesPage({ searchParams }: PageProps) {
  const { status, platform, q } = await searchParams;

  const [all, filteredMaybe] = await Promise.all([
    db.game.findMany({ orderBy: { createdAt: "desc" } }),
    (status || platform || q)
      ? db.game.findMany({
          where: {
            ...(status   ? { status }   : {}),
            ...(platform ? { platform } : {}),
            ...(q ? { OR: [
              { title:     { contains: q, mode: "insensitive" } },
              { developer: { contains: q, mode: "insensitive" } },
            ]} : {}),
          },
          select: {
            id: true, title: true, developer: true, status: true, platform: true,
            emulated: true, hoursPlayed: true, achievementsUnlocked: true,
            achievementsTotal: true, coverImage: true, rating: true,
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
          <h1 className="text-2xl font-bold text-gray-900">Games</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} games in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton />
          <SteamSyncButton />
          <Link href="/library/games/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Game
          </Link>
        </div>
      </div>
      <GameStats games={all} />
      <Suspense><GameFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No games found</p>
          <p className="text-gray-400 text-sm mt-1">{status || platform || q ? "Try adjusting your filters." : "Add your first game to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((game) => <GameCard key={game.id} game={game} />)}
        </div>
      )}
    </div>
  );
}
