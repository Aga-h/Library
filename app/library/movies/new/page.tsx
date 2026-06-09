export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MovieForm from "@/components/movies/MovieForm";
import { db } from "@/lib/db";

export default async function NewMoviePage() {
  const [directorOpts, studioOpts, yearOpts] = await Promise.all([
    db.movie.findMany({ where: { director: { not: null } }, select: { director: true }, distinct: ["director"], orderBy: { director: "asc" } })
      .then(r => r.map(x => x.director).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { studio: { not: null } }, select: { studio: true }, distinct: ["studio"], orderBy: { studio: "asc" } })
      .then(r => r.map(x => x.studio).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/library/movies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Movies
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add a New Movie</h1>
        <MovieForm mode="create" directorOptions={directorOpts} studioOptions={studioOpts} yearOptions={yearOpts} />
      </div>
    </div>
  );
}
