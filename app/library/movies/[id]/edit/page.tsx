export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import MovieForm from "@/components/movies/MovieForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMoviePage({ params }: PageProps) {
  const { id } = await params;
  const [movie, directorOpts, studioOpts, yearOpts] = await Promise.all([
    db.movie.findUnique({ where: { id } }),
    db.movie.findMany({ where: { director: { not: null } }, select: { director: true }, distinct: ["director"], orderBy: { director: "asc" } })
      .then(r => r.map(x => x.director).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { studio: { not: null } }, select: { studio: true }, distinct: ["studio"], orderBy: { studio: "asc" } })
      .then(r => r.map(x => x.studio).filter((v): v is string => v !== null && v !== "")),
    db.movie.findMany({ where: { year: { not: null } }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } })
      .then(r => r.map(x => x.year!.toString())),
  ]);
  if (!movie) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/library/movies/${movie.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Movie
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Movie</h1>
        <p className="text-sm text-gray-500 mb-6">{movie.title}</p>
        <MovieForm
          mode="edit"
          directorOptions={directorOpts}
          studioOptions={studioOpts}
          yearOptions={yearOpts}
          initialData={{
            id: movie.id,
            title: movie.title,
            director: movie.director ?? "",
            studio: movie.studio ?? "",
            status: movie.status,
            runtime: movie.runtime.toString(),
            year: movie.year?.toString() ?? "",
            language: movie.language,
            coverImage: movie.coverImage ?? "",
            rating: movie.rating?.toString() ?? "",
            timesRewatched: movie.timesRewatched.toString(),
            notes: movie.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
