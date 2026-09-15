export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Tv2, Layers, Globe } from "lucide-react";
import { db } from "@/lib/db";
import EntityCard from "@/components/ui/EntityCard";
import LevelStats from "@/components/ui/LevelStats";
import TvCard from "@/components/tv/TvCard";
import MirrorCoversButton from "@/components/ui/MirrorCoversButton";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function TvPage() {
  // Three buckets. A series inside a universe is deliberately absent from this page — you
  // reach it by opening its universe — and likewise a season inside a series.
  const [universes, looseSeries, looseShows, totals] = await Promise.all([
    db.tvUniverse.findMany({
      orderBy: { name: "asc" },
      include: { series: { select: { id: true, _count: { select: { shows: true } } } } },
    }),
    db.tvSeries.findMany({
      where: { universeId: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { shows: true } } },
    }),
    db.tvShow.findMany({ where: { seriesId: null }, orderBy: { createdAt: "desc" } }),
    db.tvShow.aggregate({ _count: { _all: true }, _sum: { episodesWatched: true } }),
  ]);

  const universeRows = universes.map((u) => ({
    id: u.id,
    name: u.name,
    seriesCount: u.series.length,
    seasonCount: u.series.reduce((s, x) => s + x._count.shows, 0),
  }));

  const totalShows = totals._count._all;
  const episodesWatched = totals._sum.episodesWatched ?? 0;

  const isEmpty =
    universeRows.length === 0 && looseSeries.length === 0 && looseShows.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TV Shows</h1>
          <p className="text-sm text-gray-500 mt-1">{count(totalShows, "season")} in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/tv/mirror-covers" />
          <Link href="/library/tv/u/new" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" /> Universe
          </Link>
          <Link href="/library/tv/s/new" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" /> Series
          </Link>
          <Link href="/library/tv/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Show
          </Link>
        </div>
      </div>

      <LevelStats
        heading="TV Stats"
        accentClass="border-orange-200 bg-orange-50 text-orange-700"
        stats={[
          { label: "Universes", value: universeRows.length },
          { label: "Series", value: universeRows.reduce((s, u) => s + u.seriesCount, 0) + looseSeries.length },
          { label: "Seasons", value: totalShows },
          { label: "Episodes Watched", value: episodesWatched },
        ]}
        footer={[
          { icon: <Tv2 className="w-4 h-4" />, label: "Episodes Watched", value: episodesWatched > 0 ? `${episodesWatched} episodes` : "—" },
        ]}
      />

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">Nothing here yet</p>
          <p className="text-gray-400 text-sm mt-1">Add a show, or group things with a series or universe.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {universeRows.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                <Globe className="w-4 h-4" /> Universes
              </h2>
              <div className={GRID}>
                {universeRows.map((u) => (
                  <EntityCard
                    key={u.id}
                    href={`/library/tv/u/${u.id}`}
                    name={u.name}
                    icon={Globe}
                    meta={`${count(u.seriesCount, "series", "series")} · ${count(u.seasonCount, "season")}`}
                  />
                ))}
              </div>
            </section>
          )}

          {looseSeries.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                <Layers className="w-4 h-4" /> Series
              </h2>
              <div className={GRID}>
                {looseSeries.map((s) => (
                  <EntityCard
                    key={s.id}
                    href={`/library/tv/s/${s.id}`}
                    name={s.name}
                    icon={Layers}
                    meta={count(s._count.shows, "season")}
                  />
                ))}
              </div>
            </section>
          )}

          {looseShows.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                <Tv2 className="w-4 h-4" /> Standalone
              </h2>
              <div className={GRID}>
                {looseShows.map((show) => <TvCard key={show.id} show={show} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
