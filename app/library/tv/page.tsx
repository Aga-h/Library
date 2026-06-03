export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import TvStats from "@/components/tv/TvStats";
import TvGroupedView from "@/components/tv/TvGroupedView";
import TvSeriesManager from "@/components/tv/TvSeriesManager";
import TvFilters from "@/components/tv/TvFilters";

interface PageProps { searchParams: Promise<{ status?: string; q?: string }> }

export default async function TvPage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;
  const all = await db.tvShow.findMany({ orderBy: { createdAt: "desc" } });
  const ql = q?.toLowerCase();
  const filtered = all.filter(s =>
    (!status || s.status === status) &&
    (!ql || s.title.toLowerCase().includes(ql) || s.creator?.toLowerCase().includes(ql) || s.network?.toLowerCase().includes(ql))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TV Shows</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} shows in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <TvSeriesManager allItems={all.map(s => ({ id: s.id, title: s.title, coverImage: s.coverImage, seriesName: s.seriesName }))} />
          <Link href="/library/tv/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Show
          </Link>
        </div>
      </div>
      <TvStats shows={all} />
      <Suspense><TvFilters /></Suspense>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No shows found</p>
          <p className="text-gray-400 text-sm mt-1">{status || q ? "Try adjusting your filters." : "Add your first show to get started."}</p>
        </div>
      ) : (
        <TvGroupedView items={filtered} />
      )}
    </div>
  );
}
