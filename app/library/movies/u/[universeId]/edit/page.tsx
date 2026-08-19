export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import HierarchyForm from "@/components/ui/HierarchyForm";

interface PageProps { params: Promise<{ universeId: string }> }

export default async function EditMovieUniversePage({ params }: PageProps) {
  const { universeId } = await params;
  const universe = await db.movieUniverse.findUnique({ where: { id: universeId } });
  if (!universe) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/movies/u/${universe.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to {universe.name}
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Universe</h1>
        <p className="text-sm text-gray-500 mb-6">{universe.name}</p>
        <HierarchyForm mode="edit" apiBase="/api/movies/universes" entityId={universe.id}
          redirectTo="/library/movies/u" entityLabel="Universe"
          initialData={{ name: universe.name, notes: universe.notes ?? "" }} />
      </div>
    </div>
  );
}
