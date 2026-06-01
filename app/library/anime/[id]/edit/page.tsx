export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import AnimeForm from "@/components/anime/AnimeForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditAnimePage({ params }: PageProps) {
  const { id } = await params;
  const [anime, seriesRows] = await Promise.all([
    db.anime.findUnique({ where: { id } }),
    db.anime.findMany({
      where: { seriesName: { not: null } },
      select: { seriesName: true },
      distinct: ["seriesName"],
    }),
  ]);
  if (!anime) notFound();
  const seriesNames = seriesRows.map((r) => r.seriesName as string);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/anime/${anime.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Anime
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Anime</h1>
        <p className="text-sm text-gray-500 mb-6">{anime.title}</p>
        <AnimeForm mode="edit" existingSeriesNames={seriesNames} initialData={{
          id: anime.id, title: anime.title, studio: anime.studio ?? "",
          status: anime.status, episodes: anime.episodes?.toString() ?? "",
          episodesWatched: anime.episodesWatched.toString(),
          episodeDuration: anime.episodeDuration.toString(),
          season: anime.season ?? "", year: anime.year?.toString() ?? "",
          language: anime.language, coverImage: anime.coverImage ?? "",
          rating: anime.rating?.toString() ?? "",
          timesRewatched: anime.timesRewatched.toString(),
          notes: anime.notes ?? "",
          seriesName: anime.seriesName ?? "",
        }} />
      </div>
    </div>
  );
}
