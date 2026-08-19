export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AnimeForm from "@/components/anime/AnimeForm";
import { db } from "@/lib/db";
import { animeSeriesOptions } from "@/lib/hierarchy-options";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewAnimePage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, studioOpts, yearOpts] = await Promise.all([
    animeSeriesOptions(),
    db.anime.findMany({ where: { studio: { not: null } }, select: { studio: true }, distinct: ["studio"], orderBy: { studio: "asc" } })
      .then(r => r.map(x => x.studio).filter((v): v is string => v !== null && v !== "")),
    db.anime.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/anime" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Anime
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Anime</h1>
        <AnimeForm mode="create" seriesOptions={seriesOpts}
          initialData={seriesId ? { seriesId } : undefined}
          studioOptions={studioOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
