"use client";

import Link from "next/link";
import { Tv2, Clock } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface TvShow {
  id: string;
  title: string;
  creator: string | null;
  status: string;
  totalEpisodes: number | null;
  episodesWatched: number;
  episodeRuntime: number;
  coverImage: string | null;
  rating: number | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  WATCHING:     { label: "Watching",      className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",     className: "bg-green-100 text-green-700" },
  PLAN_TO_WATCH:{ label: "Plan to Watch", className: "bg-amber-100 text-amber-700" },
  ON_HOLD:      { label: "On Hold",       className: "bg-purple-100 text-purple-700" },
  DROPPED:      { label: "Dropped",       className: "bg-red-100 text-red-700" },
};

export default function TvCard({ show }: { show: TvShow }) {
  const status = STATUS_STYLES[show.status] ?? STATUS_STYLES.PLAN_TO_WATCH;
  const watchedMinutes = show.episodesWatched * show.episodeRuntime;
  const timeWatched = watchedMinutes > 0 ? formatReadingTime(watchedMinutes) : null;

  const episodeProgress = show.totalEpisodes
    ? `${show.episodesWatched}/${show.totalEpisodes} ep`
    : `${show.episodesWatched} ep`;

  return (
    <Link
      href={`/tv/${show.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all"
    >
      {/* Cover */}
      <div className="relative bg-gray-100 h-44 flex items-center justify-center overflow-hidden">
        {show.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={show.coverImage}
            alt={show.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <Tv2 className="w-12 h-12 text-gray-300" />
        )}
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">
          {show.title}
        </h3>
        {show.creator && (
          <p className="text-xs text-gray-500">{show.creator}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{episodeProgress}</span>
          {timeWatched && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeWatched}
            </span>
          )}
        </div>

        {show.rating !== null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">
            ★ {show.rating}/10
          </div>
        )}
      </div>
    </Link>
  );
}
