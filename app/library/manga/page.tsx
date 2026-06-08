export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { MangaStatus, Language } from "@prisma/client";
import { db } from "@/lib/db";
import MangaStats from "@/components/manga/MangaStats";
import MangaCard from "@/components/manga/MangaCard";
import MangaFilters from "@/components/manga/MangaFilters";

interface PageProps { searchParams: Promise<{ status?: string; language?: string; q?: string }> }

export default async function MangaPage({ searchParams }: PageProps) {
  const { status, language, q } = await searchParams;

  const [all, filteredMaybe] = await Promise.all([
    db.manga.findMany({ orderBy: { createdAt: "desc" } }),
    (status || language || q)
      ? db.manga.findMany({
          where: {
            ...(status   ? { status: status as MangaStatus } : {}),
            ...(language ? { language: language as Language } : {}),
            ...(q ? { OR: [
              { title:  { contains: q, mode: "insensitive" } },
              { author: { contains: q, mode: "insensitive" } },
            ]} : {}),
          },
          select: {
            id: true, title: true, author: true, status: true, format: true,
            totalVolumes: true, volumesRead: true, totalChapters: true,
            chaptersRead: true, language: true, coverImage: true, rating: true,
            timesReread: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const filtered = filteredMaybe ?? all;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manga</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} manga in your library</p>
        </div>
        <Link href="/library/manga/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Manga
        </Link>
      </div>
      <MangaStats manga={all} />
      <Suspense><MangaFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No manga found</p>
          <p className="text-gray-400 text-sm mt-1">{status || language || q ? "Try adjusting your filters." : "Add your first manga to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((manga) => <MangaCard key={manga.id} manga={manga} />)}
        </div>
      )}
    </div>
  );
}
