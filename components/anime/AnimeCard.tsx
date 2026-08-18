import Link from "next/link";
import Image from "next/image";
import { Tv2, Clock } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface Anime {
  id: string; title: string; studio: string | null; status: string;
  episodes: number | null; episodesWatched: number; episodeDuration: number;
  season: string | null; year: number | null; language: string;
  coverImage: string | null; rating: number | null; timesRewatched: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  WATCHING:      { label: "Watching",       className: "bg-blue-100 text-blue-700" },
  COMPLETED:     { label: "Completed",      className: "bg-green-100 text-green-700" },
  PLAN_TO_WATCH: { label: "Plan to Watch",  className: "bg-amber-100 text-amber-700" },
  DROPPED:       { label: "Dropped",        className: "bg-red-100 text-red-700" },
  ON_HOLD:       { label: "On Hold",        className: "bg-purple-100 text-purple-700" },
};

export default function AnimeCard({ anime }: { anime: Anime }) {
  const status = STATUS_STYLES[anime.status] ?? STATUS_STYLES.PLAN_TO_WATCH;
  const watchedMinutes = anime.episodesWatched * anime.episodeDuration;

  return (
    <Link href={`/library/anime/${anime.id}`} className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all">
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        {anime.coverImage ? (
          <Image fill src={anime.coverImage} alt={anime.title} className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,(max-width:1280px) 25vw,20vw" />
        ) : (
          <Tv2 className="w-12 h-12 text-gray-300" />
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{anime.title}</h3>
        {anime.studio && <p className="text-xs text-gray-500">{anime.studio}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{anime.episodesWatched}{anime.episodes ? `/${anime.episodes}` : ""} ep</span>
          {watchedMinutes > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatReadingTime(watchedMinutes)}</span>}
        </div>
        {anime.rating !== null && <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">★ {anime.rating}/10</div>}
        {anime.timesRewatched > 0 && <p className="text-xs text-gray-400 mt-0.5">Rewatched ×{anime.timesRewatched}</p>}
      </div>
    </Link>
  );
}
