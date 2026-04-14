export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Gamepad2, Clock, Trophy, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { PLATFORM_LABELS } from "@/lib/constants/platforms";
import DeleteGameButton from "@/components/games/DeleteGameButton";

interface PageProps { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PLAYING:      { label: "Playing",      className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",    className: "bg-green-100 text-green-700" },
  PLAN_TO_PLAY: { label: "Plan to Play", className: "bg-amber-100 text-amber-700" },
  DROPPED:      { label: "Dropped",      className: "bg-red-100 text-red-700" },
  PLATINUM:     { label: "Platinum",     className: "bg-purple-100 text-purple-700" },
};

export default async function GameDetailPage({ params }: PageProps) {
  const { id } = await params;
  const game = await db.game.findUnique({ where: { id } });
  if (!game) notFound();

  const status = STATUS_STYLES[game.status] ?? STATUS_STYLES.PLAN_TO_PLAY;
  const platformLabel = PLATFORM_LABELS[game.platform] ?? game.platform;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Games
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex gap-6 p-8 pb-6">
          <div className="flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {game.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.coverImage} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <Gamepad2 className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{game.title}</h1>
                {game.developer && <p className="text-gray-500 mt-1">{game.developer}</p>}
                {game.publisher && <p className="text-gray-400 text-sm">{game.publisher}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/games/${game.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteGameButton gameId={game.id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{platformLabel}</span>
              {game.emulated && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-gray-100">Emulated</span>}
              {game.rating !== null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">★ {game.rating}/10</span>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-gray-100">
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Hours Played" value={game.hoursPlayed > 0 ? `${Math.round(game.hoursPlayed * 10) / 10}h` : "—"} />
          <DetailCell icon={<Trophy className="w-4 h-4" />} label="Achievements" value={game.achievementsTotal !== null ? `${game.achievementsUnlocked}/${game.achievementsTotal}` : game.achievementsUnlocked > 0 ? `${game.achievementsUnlocked}` : "—"} />
          <DetailCell icon={<Gamepad2 className="w-4 h-4" />} label="Platform" value={platformLabel} />
        </div>
        {game.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{game.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
