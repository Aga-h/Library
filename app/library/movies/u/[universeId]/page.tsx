export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import Breadcrumb from "@/components/ui/Breadcrumb";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";
import AttachExistingButton from "@/components/ui/AttachExistingButton";
import { movieTitleOptions } from "@/lib/hierarchy-options";
import MovieCard from "@/components/movies/MovieCard";
import { formatReadingTime } from "@/lib/reading-time";

interface PageProps { params: Promise<{ universeId: string }> }

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function MovieUniversePage({ params }: PageProps) {
  const { universeId } = await params;

  const [universe, allMovies] = await Promise.all([
    db.movieUniverse.findUnique({
      where: { id: universeId },
      include: { movies: { orderBy: [{ year: "asc" }, { createdAt: "asc" }] } },
    }),
    movieTitleOptions(),
  ]);
  if (!universe) notFound();

  // Filtered here rather than in the query: `{ not: universeId }` on a nullable column
  // would also drop the standalone films, which are the ones most worth offering.
  const candidates = allMovies.filter((o) => o.parentId !== universeId);

  // Films are ordered by release year here rather than by when they were added: a universe
  // is watched in release order, which the flat main page has no reason to assume.
  const watched = universe.movies.filter((m) => m.status === "WATCHED");
  const watchedMinutes = watched.reduce((s, m) => s + m.runtime * (m.timesRewatched + 1), 0);

  return (
    <div>
      <Breadcrumb rootHref="/library/movies" rootLabel="Movies" crumbs={[{ label: universe.name }]} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{universe.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {count(universe.movies.length, "film")} · {watched.length} watched
            {watchedMinutes > 0 && ` · ${formatReadingTime(watchedMinutes)}`}
          </p>
        </div>
        <div className="flex items-start justify-end flex-wrap gap-2 flex-shrink-0">
          <Link href={`/library/movies/u/${universe.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteEntityButton
            apiPath={`/api/movies/universes/${universe.id}`}
            redirectTo="/library/movies"
            warning={
              universe.movies.length > 0
                ? `The ${count(universe.movies.length, "film")} inside will move back to the main page. Nothing is deleted.`
                : undefined
            }
          />
          <AttachExistingButton
            apiBase="/api/movies"
            parentKey="universeId"
            parentId={universe.id}
            options={candidates}
            label="Add existing film"
            emptyHint="Every film you have is already in this universe."
          />
          <Link href={`/library/movies/new?universeId=${universe.id}`} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Movie
          </Link>
        </div>
      </div>

      {universe.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{universe.notes}</p>
        </div>
      )}

      {universe.movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No films yet</p>
          <p className="text-gray-400 text-sm mt-1">Add the first film in {universe.name}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {universe.movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      )}
    </div>
  );
}
