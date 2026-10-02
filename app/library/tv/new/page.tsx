export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import TvForm from "@/components/tv/TvForm";
import TmdbTvImport from "@/components/tv/TmdbTvImport";
import { db } from "@/lib/db";
import { tvSeriesOptions, tvUniverseOptions } from "@/lib/hierarchy-options";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewTvPage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, universeOpts, creatorOpts, networkOpts, yearOpts] = await Promise.all([
    tvSeriesOptions(),
    tvUniverseOptions(),
    db.tvShow.findMany({ where: { creator: { not: null } }, select: { creator: true }, distinct: ["creator"], orderBy: { creator: "asc" } })
      .then(r => r.map(x => x.creator).filter((v): v is string => v !== null && v !== "")),
    db.tvShow.findMany({ where: { network: { not: null } }, select: { network: true }, distinct: ["network"], orderBy: { network: "asc" } })
      .then(r => r.map(x => x.network).filter((v): v is string => v !== null && v !== "")),
    db.tvShow.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);

  // Adding from a series page: offer the next season and the name to build the title from,
  // the same way comics suggests the next issue number.
  const series = seriesId
    ? await db.tvSeries.findUnique({
        where: { id: seriesId },
        select: {
          name: true,
          shows: {
            where: { seasonNumber: { not: null } },
            select: { seasonNumber: true },
            orderBy: { seasonNumber: "desc" },
            take: 1,
          },
        },
      })
    : null;
  const highest = series?.shows[0]?.seasonNumber ?? 0;
  const nextSeason = series ? String(highest + 1) : "";
  const prefillTitle = series ? `${series.name} | Season ${nextSeason}` : "";

  // Adding a season to a series is by hand; everywhere else TMDB comes first, since it brings a
  // whole show — every season — in one go.
  const back = series
    ? { href: `/library/tv/s/${seriesId}`, label: `Back to ${series.name}` }
    : { href: "/library/tv", label: "Back to TV Shows" };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> {back.label}
      </Link>
      {!series && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Add TV Shows</h1>
          <p className="text-sm text-gray-500 mb-6">
            Search TMDB — each show comes in as a series with every season, episodes, runtime and poster
            included. A whole franchise can come in at once.
          </p>
          <TmdbTvImport universes={universeOpts.map(({ id, name }) => ({ id, name }))} initialUniverseId={null} />
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        {series ? (
          <h1 className="text-xl font-bold text-gray-900 mb-6">Add Season</h1>
        ) : (
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6">Or add a single season by hand</h2>
        )}
        <TvForm mode="create" seriesOptions={seriesOpts}
          seriesName={series?.name}
          initialData={seriesId ? { seriesId, seasonNumber: nextSeason, title: prefillTitle } : undefined}
          creatorOptions={creatorOpts} networkOptions={networkOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
