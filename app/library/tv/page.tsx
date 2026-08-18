export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import TvStats from "@/components/tv/TvStats";
import TvGroupedView from "@/components/tv/TvGroupedView";
import TvSeriesManager from "@/components/tv/TvSeriesManager";
import TvFilters from "@/components/tv/TvFilters";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { TV_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";

interface PageProps { searchParams: Promise<{ status?: string; q?: string }> }

export default async function TvPage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;
  const [total, seriesItems] = await Promise.all([
    db.tvShow.count(),
    db.tvShow.findMany({
      select: { id: true, title: true, coverImage: true, seriesName: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TV Shows</h1>
          <p className="text-sm text-gray-500 mt-1">{total} shows in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <TvSeriesManager allItems={seriesItems} />
          <MirrorCoversButton apiPath="/api/tv/mirror-covers" />
          <Link href="/library/tv/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Show
          </Link>
        </div>
      </div>
      <Suspense><TvFilters /></Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <TvContent status={status} q={q} />
      </Suspense>
    </div>
  );
}

async function TvContent({ status, q }: { status?: string; q?: string }) {
  const [statsRows, filtered] = await Promise.all([
    // Stats-only projection: fetching every column pulled unbounded `notes` for every
    // row just to compute a handful of counters.
    db.tvShow.findMany({ select: { status: true, totalEpisodes: true, episodesWatched: true, episodeRuntime: true, timesRewatched: true }, orderBy: { createdAt: "desc" } }),
    db.tvShow.findMany({
      where: {
        ...(asEnum(status, TV_STATUS_VALUES) ? { status: asEnum(status, TV_STATUS_VALUES) } : {}),
        ...(q ? { OR: [
          { title:   { contains: q, mode: "insensitive" } },
          { creator: { contains: q, mode: "insensitive" } },
          { network: { contains: q, mode: "insensitive" } },
        ]} : {}),
      },
      select: {
        id: true, title: true, creator: true, network: true, status: true,
        totalEpisodes: true, episodesWatched: true, episodeRuntime: true,
        year: true, language: true, coverImage: true, rating: true,
        timesRewatched: true, seriesName: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <TvStats shows={statsRows} />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No shows found</p>
          <p className="text-gray-400 text-sm mt-1">{status || q ? "Try adjusting your filters." : "Add your first show to get started."}</p>
        </div>
      ) : (
        <TvGroupedView items={filtered} />
      )}
    </>
  );
}
