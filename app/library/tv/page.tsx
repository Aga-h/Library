export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import TvStats from "@/components/tv/TvStats";
import TvCard from "@/components/tv/TvCard";
import TvFilters from "@/components/tv/TvFilters";

type TvShow = Awaited<ReturnType<typeof db.tvShow.findMany>>[number];

interface PageProps { searchParams: Promise<{ status?: string }> }

export default async function TvPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [all, filtered] = await Promise.all([
    db.tvShow.findMany({ orderBy: { createdAt: "desc" } }),
    db.tvShow.findMany({ where, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TV Shows</h1>
          <p className="text-sm text-gray-500 mt-1">{all.length} shows in your library</p>
        </div>
        <Link href="/library/tv/new" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Show
        </Link>
      </div>
      <TvStats shows={all} />
      <Suspense><TvFilters /></Suspense>
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No shows found</p>
          <p className="text-gray-400 text-sm mt-1">{status ? "Try adjusting your filters." : "Add your first show to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((show: TvShow) => <TvCard key={show.id} show={show} />)}
        </div>
      )}
    </div>
  );
}
