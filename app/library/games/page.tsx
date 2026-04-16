export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import GameStats from "@/components/games/GameStats";
import GameCard from "@/components/games/GameCard";
import GameFilters from "@/components/games/GameFilters";

type Game = Awaited<ReturnType<typeof db.game.findMany>>[number];

interface PageProps { searchParams: Promise<{ status?: string; platform?: string }> }

export default async function GamesPage({ searchParams }: PageProps) {
  const { status, platform } = await searchParams;
  const all = await db.game.findMany({ orderBy: { createdAt: "desc" } });
  const filtered = all.filter(g => (!status || g.status === status) && (!platform || g.platform === platform));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Games</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} games in your library</p>
        </div>
        <Link href="/library/games/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Game
        </Link>
      </div>
      <GameStats games={all} />
      <Suspense><GameFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No games found</p>
          <p className="text-gray-400 text-sm mt-1">{status || platform ? "Try adjusting your filters." : "Add your first game to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((game: Game) => <GameCard key={game.id} game={game} />)}
        </div>
      )}
    </div>
  );
}
