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
  const movie = await db.movie.findUnique({ where: { id } });
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
            notes: movie.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
