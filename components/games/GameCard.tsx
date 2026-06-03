"use client";

import Link from "next/link";
import { Gamepad2, Clock, Trophy } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/constants/platforms";
import { thumbUrl } from "@/lib/covers";

interface Game {
  id: string; title: string; developer: string | null; status: string;
  platform: string; emulated: boolean; hoursPlayed: number;
  achievementsUnlocked: number; achievementsTotal: number | null;
  coverImage: string | null; rating: number | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PLAYING:      { label: "Playing",       className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",     className: "bg-green-100 text-green-700" },
  PLAN_TO_PLAY: { label: "Plan to Play",  className: "bg-amber-100 text-amber-700" },
  DROPPED:      { label: "Dropped",       className: "bg-red-100 text-red-700" },
  PLATINUM:     { label: "Platinum",      className: "bg-purple-100 text-purple-700" },
};

export default function GameCard({ game }: { game: Game }) {
  const status = STATUS_STYLES[game.status] ?? STATUS_STYLES.PLAN_TO_PLAY;
  const platformLabel = PLATFORM_LABELS[game.platform] ?? game.platform;

  return (
    <Link href={`/library/games/${game.id}`} className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all">
      <div className="relative bg-gray-100 aspect-[2/3] overflow-hidden">
        {/* Placeholder sits permanently underneath — shows when coverImage is null or URL 404s */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Gamepad2 className="w-12 h-12 text-gray-300" />
        </div>
        {/* CSS background-image: if URL 404s it simply doesn't paint — no broken icon possible */}
        {game.coverImage && (
          <div
            className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
            style={{ backgroundImage: `url("${thumbUrl(game.coverImage, 300) ?? game.coverImage}")` }}
          />
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
        {game.emulated && <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-100">EMU</span>}
      </div>
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{game.title}</h3>
        {game.developer && <p className="text-xs text-gray-500">{game.developer}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{platformLabel}</span>
          {game.hoursPlayed > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(game.hoursPlayed * 10) / 10}h</span>}
          {game.achievementsTotal !== null && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{game.achievementsUnlocked}/{game.achievementsTotal}</span>}
        </div>
        {game.rating !== null && <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">★ {game.rating}/10</div>}
      </div>
    </Link>
  );
}
