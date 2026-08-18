import Link from "next/link";
import Image from "next/image";
import { Film, Clock } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface Movie {
  id: string;
  title: string;
  director: string | null;
  status: string;
  runtime: number;
  year: number | null;
  coverImage: string | null;
  rating: number | null;
  timesRewatched: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  WATCHED:       { label: "Watched",       className: "bg-green-100 text-green-700" },
  WANT_TO_WATCH: { label: "Want to Watch", className: "bg-amber-100 text-amber-700" },
  DROPPED:       { label: "Dropped",       className: "bg-red-100 text-red-700" },
};

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function MovieCard({ movie }: { movie: Movie }) {
  const status = STATUS_STYLES[movie.status] ?? STATUS_STYLES.WANT_TO_WATCH;

  return (
    <Link
      href={`/library/movies/${movie.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all"
    >
      {/* Cover */}
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        {movie.coverImage ? (
          <Image fill src={movie.coverImage} alt={movie.title} className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,(max-width:1280px) 25vw,20vw" />
        ) : (
          <Film className="w-12 h-12 text-gray-300" />
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
          {movie.title}
        </h3>
        {movie.director && (
          <p className="text-xs text-gray-500">{movie.director}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          {movie.year && <span>{movie.year}</span>}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatRuntime(movie.runtime)}
          </span>
        </div>

        {movie.rating !== null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">
            ★ {movie.rating}/10
          </div>
        )}
        {movie.timesRewatched > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">Rewatched ×{movie.timesRewatched}</p>
        )}
      </div>
    </Link>
  );
}
