export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import MovieStats from "@/components/movies/MovieStats";
import MovieCard from "@/components/movies/MovieCard";
import MovieFilters from "@/components/movies/MovieFilters";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { MOVIE_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function MoviesPage({ searchParams }: PageProps) {
  const { status, q } = await searchParams;
  const total = await db.movie.count();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movies</h1>
          <p className="text-sm text-gray-500 mt-1">{total} movies in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/movies/mirror-covers" />
          <Link
            href="/library/movies/new"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Movie
          </Link>
        </div>
      </div>
      <Suspense><MovieFilters /></Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <MovieContent status={status} q={q} />
      </Suspense>
    </div>
  );
}

async function MovieContent({ status, q }: { status?: string; q?: string }) {
  const [statsRows, filtered] = await Promise.all([
    // Stats-only projection: fetching every column pulled unbounded `notes` for every
    // row just to compute a handful of counters.
    db.movie.findMany({ select: { status: true, runtime: true, timesRewatched: true }, orderBy: { createdAt: "desc" } }),
    db.movie.findMany({
      where: {
        ...(asEnum(status, MOVIE_STATUS_VALUES) ? { status: asEnum(status, MOVIE_STATUS_VALUES) } : {}),
        ...(q ? { OR: [
          { title:    { contains: q, mode: "insensitive" } },
          { director: { contains: q, mode: "insensitive" } },
          { studio:   { contains: q, mode: "insensitive" } },
        ]} : {}),
      },
      select: {
        id: true, title: true, director: true, status: true,
        runtime: true, year: true, coverImage: true, rating: true, timesRewatched: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <MovieStats movies={statsRows} />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No movies found</p>
          <p className="text-gray-400 text-sm mt-1">
            {status || q ? "Try adjusting your filters." : "Add your first movie to get started."}
          </p>
          {!status && !q && (
            <Link
              href="/library/movies/new"
              className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Movie
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      )}
    </>
  );
}
