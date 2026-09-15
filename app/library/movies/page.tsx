export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus, Film, Globe } from "lucide-react";
import { db } from "@/lib/db";
import MovieStats from "@/components/movies/MovieStats";
import MovieCard from "@/components/movies/MovieCard";
import MovieFilters from "@/components/movies/MovieFilters";
import EntityCard from "@/components/ui/EntityCard";
import MirrorCoversButton from "@/components/ui/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { MOVIE_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

const CARD_FIELDS = {
  id: true, title: true, director: true, status: true,
  runtime: true, year: true, coverImage: true, rating: true, timesRewatched: true,
} as const;

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

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
          <p className="text-sm text-gray-500 mt-1">{count(total, "movie")} in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/movies/mirror-covers" />
          <Link href="/library/movies/u/new" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" /> Universe
          </Link>
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
  const statusFilter = asEnum(status, MOVIE_STATUS_VALUES);
  // A filter searches the whole library, universes included — otherwise a film inside one
  // would be unfindable from here. Unfiltered, the page is the two buckets.
  const filtering = Boolean(statusFilter || q);

  // Stats-only projection: fetching every column pulled unbounded `notes` for every
  // row just to compute a handful of counters.
  const statsRows = await db.movie.findMany({
    select: { status: true, runtime: true, timesRewatched: true },
  });

  return (
    <>
      <MovieStats movies={statsRows} />
      {filtering ? <FilteredGrid statusFilter={statusFilter} q={q} /> : <Buckets />}
    </>
  );
}

async function FilteredGrid({
  statusFilter, q,
}: {
  statusFilter: (typeof MOVIE_STATUS_VALUES)[number] | undefined;
  q?: string;
}) {
  const filtered = await db.movie.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q ? { OR: [
        { title:    { contains: q, mode: "insensitive" as const } },
        { director: { contains: q, mode: "insensitive" as const } },
        { studio:   { contains: q, mode: "insensitive" as const } },
      ]} : {}),
    },
    select: CARD_FIELDS,
    orderBy: { createdAt: "desc" },
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No movies found</p>
        <p className="text-gray-400 text-sm mt-1">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className={GRID}>
      {filtered.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
    </div>
  );
}

async function Buckets() {
  // Two buckets, not three: movies have no series tier, so a film is either in a universe
  // or standalone. A film inside a universe is reached by opening that universe.
  const [universes, looseMovies] = await Promise.all([
    db.movieUniverse.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { movies: true } } },
    }),
    db.movie.findMany({ where: { universeId: null }, select: CARD_FIELDS, orderBy: { createdAt: "desc" } }),
  ]);

  if (universes.length === 0 && looseMovies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No movies yet</p>
        <p className="text-gray-400 text-sm mt-1">Add your first movie to get started.</p>
        <Link
          href="/library/movies/new"
          className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Movie
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {universes.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            <Globe className="w-4 h-4" /> Universes
          </h2>
          <div className={GRID}>
            {universes.map((u) => (
              <EntityCard
                key={u.id}
                href={`/library/movies/u/${u.id}`}
                name={u.name}
                icon={Globe}
                meta={count(u._count.movies, "film")}
              />
            ))}
          </div>
        </section>
      )}

      {looseMovies.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            <Film className="w-4 h-4" /> Standalone
          </h2>
          <div className={GRID}>
            {looseMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        </section>
      )}
    </div>
  );
}
