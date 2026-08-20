export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import TvForm from "@/components/tv/TvForm";
import { db } from "@/lib/db";
import { tvSeriesOptions } from "@/lib/hierarchy-options";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewTvPage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, creatorOpts, networkOpts, yearOpts] = await Promise.all([
    tvSeriesOptions(),
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
  const prefillTitle = series ? `${series.name} Season ${nextSeason}` : "";

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/tv" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to TV Shows
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add TV Show</h1>
        <TvForm mode="create" seriesOptions={seriesOpts}
          seriesName={series?.name}
          initialData={seriesId ? { seriesId, seasonNumber: nextSeason, title: prefillTitle } : undefined}
          creatorOptions={creatorOpts} networkOptions={networkOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
