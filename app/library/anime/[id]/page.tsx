export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Tv2, Clock, Globe, Calendar, Pencil, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { formatReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { MalNotice } from "@/components/tmdb/TmdbParts";
import DeleteAnimeButton from "@/components/anime/DeleteAnimeButton";

interface PageProps { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  WATCHING:      { label: "Watching",       className: "bg-blue-100 text-blue-700" },
  COMPLETED:     { label: "Completed",      className: "bg-green-100 text-green-700" },
  PLAN_TO_WATCH: { label: "Plan to Watch",  className: "bg-amber-100 text-amber-700" },
};

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall",
};

export default async function AnimeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const anime = await db.anime.findUnique({
    where: { id },
    include: { series: { include: { universe: true } } },
  });
  if (!anime) notFound();

  const status = STATUS_STYLES[anime.status] ?? STATUS_STYLES.PLAN_TO_WATCH;
  const langLabel = LANGUAGE_CONFIG[anime.language as LanguageKey]?.label ?? anime.language;
  const watchedMinutes = anime.episodesWatched * anime.episodeDuration * (anime.timesRewatched + 1);

  return (
    <div className="max-w-2xl mx-auto">
      <Breadcrumb
        rootHref="/library/anime"
        rootLabel="Anime"
        crumbs={[
          ...(anime.series?.universe
            ? [{ label: anime.series.universe.name, href: `/library/anime/u/${anime.series.universe.id}` }]
            : []),
          ...(anime.series ? [{ label: anime.series.name, href: `/library/anime/s/${anime.series.id}` }] : []),
          { label: anime.title },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Phones: a grid instead — the title across the top at full width, then the cover with the
            actions, tags and link beside it (the wrappers below step aside with `contents`). Beside
            the 112px cover the title was a narrow column and Edit/Delete were pushed off the card. */}
        <div className="flex gap-6 p-8 pb-6 max-sm:grid max-sm:grid-cols-[6rem_minmax(0,1fr)] max-sm:grid-rows-[auto_auto_auto_auto_1fr] max-sm:gap-x-4 max-sm:gap-y-3 max-sm:p-4">
          <div className="flex-shrink-0 w-28 h-40 max-sm:w-full max-sm:h-36 max-sm:self-start max-sm:row-start-2 max-sm:row-span-4 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {anime.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
            ) : (
              <Tv2 className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0 max-sm:contents">
            {/* From sm the buttons wrap under the title when its longest word leaves them no room
                beside it (acid's giant titles) — they were pushed off the card. */}
            <div className="flex items-start justify-between gap-4 sm:flex-wrap max-sm:contents">
              <div className="max-sm:col-span-2 max-sm:row-start-1 max-sm:min-w-0 sm:grow sm:basis-0">
                <h1 className="text-xl font-bold text-gray-900 leading-snug break-words">{anime.title}</h1>
                {anime.studio && <p className="text-gray-500 mt-1 break-words">{anime.studio}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0 max-sm:flex-wrap max-sm:col-start-2 max-sm:row-start-2">
                <Link href={`/library/anime/${anime.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteAnimeButton animeId={anime.id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 max-sm:mt-0 max-sm:col-start-2 max-sm:row-start-3">
              {anime.seasonNumber !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-900 text-white">
                  Season {anime.seasonNumber}
                </span>
              )}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
              {anime.season && anime.year && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{SEASON_LABELS[anime.season]} {anime.year}</span>}
              {anime.rating !== null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">★ {anime.rating}/10</span>}
            </div>
            {anime.malId && (
              <a href={`https://myanimelist.net/anime/${anime.malId}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-gray-500 hover:text-gray-900 max-sm:mt-0 max-sm:col-start-2 max-sm:row-start-4 max-sm:self-start max-sm:py-2.5 max-sm:-my-2.5">
                MyAnimeList <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          <DetailCell icon={<Tv2 className="w-4 h-4" />} label="Episodes" value={`${anime.episodesWatched}${anime.episodes ? `/${anime.episodes}` : ""}`} />
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Time Watched" value={watchedMinutes > 0 ? formatReadingTime(watchedMinutes) : "—"} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
          <DetailCell icon={<Calendar className="w-4 h-4" />} label="Year" value={anime.year?.toString() ?? "—"} />
        </div>

        {anime.notes && (
          <div className="p-4 sm:p-8 sm:pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{anime.notes}</p>
          </div>
        )}
      </div>
      {anime.malId && <MalNotice className="mt-4" />}
    </div>
  );
}

function DetailCell({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800 max-w-full break-words">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
