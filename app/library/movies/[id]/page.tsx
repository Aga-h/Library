export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Film,
  Clock,
  Globe,
  Building2,
  Pencil,
  Calendar,
  } from "lucide-react";
import { db } from "@/lib/db";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteMovieButton from "@/components/movies/DeleteMovieButton";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function MovieDetailPage({ params }: PageProps) {
  const { id } = await params;
  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) notFound();

  const status = STATUS_STYLES[movie.status] ?? STATUS_STYLES.WANT_TO_WATCH;
  const langLabel = LANGUAGE_CONFIG[movie.language as LanguageKey]?.label ?? movie.language;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/library/movies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Movies
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Cover + header */}
        <div className="flex gap-6 p-8 pb-6">
          <div className="flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {movie.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={movie.coverImage}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-10 h-10 text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">
                  {movie.title}
                </h1>
                {movie.director && (
                  <p className="text-gray-500 mt-1">{movie.director}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/library/movies/${movie.id}/edit`}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteMovieButton movieId={movie.id} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
                {status.label}
              </span>
              {movie.rating !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                  ★ {movie.rating}/10
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Runtime" value={formatRuntime(movie.runtime)} sub={`${movie.runtime} min`} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
          {movie.year && (
            <DetailCell icon={<Calendar className="w-4 h-4" />} label="Year" value={movie.year.toString()} />
          )}
          {movie.studio && (
            <DetailCell icon={<Building2 className="w-4 h-4" />} label="Studio" value={movie.studio} />
          )}
          {!movie.year && (
            <DetailCell icon={<Calendar className="w-4 h-4" />} label="Year" value="—" />
          )}
          {!movie.studio && (
            <DetailCell icon={<Building2 className="w-4 h-4" />} label="Studio" value="—" />
          )}
        </div>

        {/* Notes */}
        {movie.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Notes
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{movie.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
