export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Film,
  Clock,
  Globe,
  Building2,
  Pencil,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteMovieButton from "@/components/movies/DeleteMovieButton";
import { TmdbNotice } from "@/components/tmdb/TmdbParts";

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
  const movie = await db.movie.findUnique({
    where: { id },
    include: { universe: true },
  });
  if (!movie) notFound();

  const status = STATUS_STYLES[movie.status] ?? STATUS_STYLES.WANT_TO_WATCH;
  const langLabel = LANGUAGE_CONFIG[movie.language as LanguageKey]?.label ?? movie.language;

  return (
    <div className="max-w-2xl mx-auto">
      <Breadcrumb
        rootHref="/library/movies"
        rootLabel="Movies"
        crumbs={[
          ...(movie.universe
            ? [{ label: movie.universe.name, href: `/library/movies/u/${movie.universe.id}` }]
            : []),
          { label: movie.title },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Cover + header */}
        {/* Phones: a grid instead — the title across the top at full width, then the cover with the
            actions, tags and links beside it (the wrappers below step aside with `contents`). Beside
            the 112px cover the title was a narrow column and Edit/Delete were pushed off the card. */}
        <div className="flex gap-6 p-8 pb-6 max-sm:grid max-sm:grid-cols-[6rem_minmax(0,1fr)] max-sm:grid-rows-[auto_auto_auto_auto_1fr] max-sm:gap-x-4 max-sm:gap-y-3 max-sm:p-4">
          <div className="flex-shrink-0 w-28 h-40 max-sm:w-full max-sm:h-36 max-sm:self-start max-sm:row-start-2 max-sm:row-span-4 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
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

          <div className="flex-1 min-w-0 max-sm:contents">
            {/* From sm the buttons wrap under the title when its longest word leaves them no room
                beside it (acid's giant titles) — they were pushed off the card. */}
            <div className="flex items-start justify-between gap-4 sm:flex-wrap max-sm:contents">
              <div className="max-sm:col-span-2 max-sm:row-start-1 max-sm:min-w-0 sm:grow sm:basis-0">
                <h1 className="text-xl font-bold text-gray-900 leading-snug break-words">
                  {movie.title}
                </h1>
                {movie.director && (
                  <p className="text-gray-500 mt-1 break-words">{movie.director}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 max-sm:flex-wrap max-sm:col-start-2 max-sm:row-start-2">
                <Link
                  href={`/library/movies/${movie.id}/edit`}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteMovieButton movieId={movie.id} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 max-sm:mt-0 max-sm:col-start-2 max-sm:row-start-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
                {status.label}
              </span>
              {movie.rating !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                  ★ {movie.rating}/10
                </span>
              )}
            </div>

            {(movie.imdbId || movie.tmdbId) && (
              <div className="flex flex-wrap gap-3 mt-3 text-xs font-semibold max-sm:mt-0 max-sm:gap-x-5 max-sm:col-start-2 max-sm:row-start-4 max-sm:self-start">
                {/* Phones: a 36px-tall hit area for each link, without moving them. */}
                {movie.imdbId && (
                  <a href={`https://www.imdb.com/title/${movie.imdbId}/`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 max-sm:py-2.5 max-sm:-my-2.5">
                    IMDb <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {movie.tmdbId && (
                  <a href={`https://www.themoviedb.org/movie/${movie.tmdbId}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 max-sm:py-2.5 max-sm:-my-2.5">
                    TMDB <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          {/* 0 is "not known yet" — a film imported from TMDB before its release. */}
          {movie.runtime > 0 ? (
            <DetailCell icon={<Clock className="w-4 h-4" />} label="Runtime" value={formatRuntime(movie.runtime)} sub={`${movie.runtime} min`} />
          ) : (
            <DetailCell icon={<Clock className="w-4 h-4" />} label="Runtime" value="—" sub="not known yet" />
          )}
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
          <div className="p-4 sm:p-8 sm:pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Notes
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{movie.notes}</p>
          </div>
        )}
      </div>

      {movie.tmdbId && <TmdbNotice className="mt-4" />}
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
    <div className="min-w-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800 max-w-full break-words">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
