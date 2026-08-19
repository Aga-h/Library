export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Tv2, Clock, Globe, Calendar, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { formatReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteTvButton from "@/components/tv/DeleteTvButton";

interface PageProps { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  WATCHING:      { label: "Watching",       className: "bg-blue-100 text-blue-700" },
  COMPLETED:     { label: "Completed",      className: "bg-green-100 text-green-700" },
  PLAN_TO_WATCH: { label: "Plan to Watch",  className: "bg-amber-100 text-amber-700" },
};

export default async function TvDetailPage({ params }: PageProps) {
  const { id } = await params;
  const show = await db.tvShow.findUnique({ where: { id } });
  if (!show) notFound();

  const status = STATUS_STYLES[show.status] ?? STATUS_STYLES.PLAN_TO_WATCH;
  const langLabel = LANGUAGE_CONFIG[show.language as LanguageKey]?.label ?? show.language;
  const watchedMinutes = show.episodesWatched * show.episodeRuntime * (show.timesRewatched + 1);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/tv" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to TV Shows
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex gap-6 p-8 pb-6">
          <div className="flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {show.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={show.coverImage} alt={show.title} className="w-full h-full object-cover" />
            ) : (
              <Tv2 className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{show.title}</h1>
                {show.creator && <p className="text-gray-500 mt-1">{show.creator}</p>}
                {show.network && <p className="text-gray-400 text-sm">{show.network}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/library/tv/${show.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteTvButton showId={show.id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
              {show.rating !== null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">★ {show.rating}/10</span>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          <DetailCell icon={<Tv2 className="w-4 h-4" />} label="Episodes" value={`${show.episodesWatched}${show.totalEpisodes ? `/${show.totalEpisodes}` : ""}`} />
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Time Watched" value={watchedMinutes > 0 ? formatReadingTime(watchedMinutes) : "—"} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
          <DetailCell icon={<Calendar className="w-4 h-4" />} label="Year" value={show.year?.toString() ?? "—"} />
        </div>
        {show.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{show.notes}</p>
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
