export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import HierarchyForm from "@/components/ui/HierarchyForm";

export default function NewMovieUniversePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/movies" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 py-2.5 -mt-2.5 mb-3.5 sm:py-0 sm:mt-0 sm:mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 shrink-0" /> Back to Movies
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add Universe</h1>
        <HierarchyForm mode="create" apiBase="/api/movies/universes" redirectTo="/library/movies/u"
          entityLabel="Universe" namePlaceholder="e.g. The Marvel Cinematic Universe" />
      </div>
    </div>
  );
}
