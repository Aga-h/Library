export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AnimeForm from "@/components/anime/AnimeForm";
import MalImport from "@/components/anime/MalImport";
import { db } from "@/lib/db";
import { animeSeriesOptions, animeUniverseOptions } from "@/lib/hierarchy-options";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewAnimePage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, universeOpts, studioOpts, yearOpts] = await Promise.all([
    animeSeriesOptions(),
    animeUniverseOptions(),
    db.anime.findMany({ where: { studio: { not: null } }, select: { studio: true }, distinct: ["studio"], orderBy: { studio: "asc" } })
      .then(r => r.map(x => x.studio).filter((v): v is string => v !== null && v !== "")),
    db.anime.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);

  // Adding from a series page: offer the next season and the name to build the title from,
  // the same way comics suggests the next issue number.
  const series = seriesId
    ? await db.animeSeries.findUnique({
        where: { id: seriesId },
        select: {
          name: true,
          anime: {
            where: { seasonNumber: { not: null } },
            select: { seasonNumber: true },
            orderBy: { seasonNumber: "desc" },
            take: 1,
          },
        },
      })
    : null;
  const highest = series?.anime[0]?.seasonNumber ?? 0;
  const nextSeason = series ? String(highest + 1) : "";
  const prefillTitle = series ? `${series.name} | Season ${nextSeason}` : "";

  // Adding a season to a series is by hand; everywhere else MyAnimeList comes first, since it
  // brings a whole run — every season and film — in one go.
  const back = series
    ? { href: `/library/anime/s/${seriesId}`, label: `Back to ${series.name}` }
    : { href: "/library/anime", label: "Back to Anime" };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> {back.label}
      </Link>
      {!series && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Add Anime</h1>
          <p className="text-sm text-gray-500 mb-6">
            Search MyAnimeList and pick any season — the whole run comes up in watch order, with
            episodes, episode length, studio and poster, to import as a series.
          </p>
          <MalImport universes={universeOpts.map(({ id, name }) => ({ id, name }))} initialUniverseId={null} />
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        {series ? (
          <h1 className="text-xl font-bold text-gray-900 mb-6">Add Season</h1>
        ) : (
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6">Or add one by hand</h2>
        )}
        <AnimeForm mode="create" seriesOptions={seriesOpts}
          seriesName={series?.name}
          initialData={seriesId ? { seriesId, seasonNumber: nextSeason, title: prefillTitle } : undefined}
          studioOptions={studioOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
