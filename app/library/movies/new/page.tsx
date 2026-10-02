export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MovieForm from "@/components/movies/MovieForm";
import TmdbImport from "@/components/movies/TmdbImport";
import { db } from "@/lib/db";
import { movieUniverseOptions } from "@/lib/hierarchy-options";

interface PageProps { searchParams: Promise<{ universeId?: string }> }

export default async function NewMoviePage({ searchParams }: PageProps) {
  const { universeId } = await searchParams;
  const [universeOpts, directorOpts, studioOpts, yearOpts] = await Promise.all([
    movieUniverseOptions(),
    db.movie.findMany({ where: { director: { not: null } }, select: { director: true }, distinct: ["director"], orderBy: { director: "asc" } })
      .then(r => r.map(x => x.director).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { studio: { not: null } }, select: { studio: true }, distinct: ["studio"], orderBy: { studio: "asc" } })
      .then(r => r.map(x => x.studio).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);

  // Arriving from a universe's "Add Movie" files films into that universe and leads back to it.
  const universe = universeId ? universeOpts.find((u) => u.id === universeId) ?? null : null;
  const back = universe
    ? { href: `/library/movies/u/${universe.id}`, label: `Back to ${universe.name}` }
    : { href: "/library/movies", label: "Back to Movies" };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {back.label}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Movies</h1>
        <p className="text-sm text-gray-500 mb-6">
          Search TMDB — director, studio, runtime, year and poster come with each film. A whole
          franchise can come in at once.
        </p>
        <TmdbImport
          universes={universeOpts.map(({ id, name }) => ({ id, name }))}
          initialUniverseId={universe?.id ?? null}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6">Or add it by hand</h2>
        <MovieForm mode="create" universeOptions={universeOpts}
          initialData={universe ? { universeId: universe.id } : undefined}
          directorOptions={directorOpts} studioOptions={studioOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
