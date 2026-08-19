export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import HierarchyForm from "@/components/ui/HierarchyForm";

export default function NewBookSeriesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/books" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Books
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Series</h1>
        <p className="text-sm text-gray-500 mb-6">
          Not in a universe — it will show on the main page. You can move it into one later.
        </p>
        <HierarchyForm mode="create" apiBase="/api/books/series" redirectTo="/library/books/s"
          entityLabel="Series" namePlaceholder="e.g. The Lord of the Rings" />
      </div>
    </div>
  );
}
