export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import GameForm from "@/components/games/GameForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditGamePage({ params }: PageProps) {
  const { id } = await params;
  const game = await db.game.findUnique({ where: { id } });
  if (!game) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/games/${game.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Game
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Game</h1>
        <p className="text-sm text-gray-500 mb-6">{game.title}</p>
        <GameForm mode="edit" initialData={{
          id: game.id, title: game.title, developer: game.developer ?? "",
          publisher: game.publisher ?? "", status: game.status, platform: game.platform,
          emulated: game.emulated, hoursPlayed: game.hoursPlayed.toString(),
          achievementsUnlocked: game.achievementsUnlocked.toString(),
          achievementsTotal: game.achievementsTotal?.toString() ?? "",
          coverImage: game.coverImage ?? "", rating: game.rating?.toString() ?? "",
          notes: game.notes ?? "",
        }} />
      </div>
    </div>
  );
}
