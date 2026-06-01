import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import GameForm from "@/components/games/GameForm";
import { db } from "@/lib/db";

export default async function NewGamePage() {
  const [developerOpts, publisherOpts] = await Promise.all([
    db.game.findMany({ where: { developer: { not: null } }, select: { developer: true }, distinct: ["developer"], orderBy: { developer: "asc" } })
      .then(r => r.map(x => x.developer).filter((v): v is string => v !== null && v !== "")),
    db.game.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/games" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Games
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Game</h1>
        <GameForm mode="create" developerOptions={developerOpts} publisherOptions={publisherOpts} />
      </div>
    </div>
  );
}
