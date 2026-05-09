export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import TvForm from "@/components/tv/TvForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditTvPage({ params }: PageProps) {
  const { id } = await params;
  const show = await db.tvShow.findUnique({ where: { id } });
  if (!show) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/tv/${show.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Show
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit TV Show</h1>
        <p className="text-sm text-gray-500 mb-6">{show.title}</p>
        <TvForm mode="edit" initialData={{
          id: show.id, title: show.title, creator: show.creator ?? "",
          network: show.network ?? "", status: show.status,
          totalEpisodes: show.totalEpisodes?.toString() ?? "",
          episodesWatched: show.episodesWatched.toString(),
          episodeRuntime: show.episodeRuntime.toString(),
          year: show.year?.toString() ?? "", language: show.language,
          coverImage: show.coverImage ?? "", rating: show.rating?.toString() ?? "",
          timesRewatched: show.timesRewatched.toString(),
          notes: show.notes ?? "",
        }} />
      </div>
    </div>
  );
}
