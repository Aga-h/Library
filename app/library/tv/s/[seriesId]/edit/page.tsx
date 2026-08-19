export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import HierarchyForm from "@/components/ui/HierarchyForm";
import { tvUniverseOptions } from "@/lib/hierarchy-options";

interface PageProps { params: Promise<{ seriesId: string }> }

export default async function EditTvSeriesPage({ params }: PageProps) {
  const { seriesId } = await params;
  const [series, universeOptions] = await Promise.all([
    db.tvSeries.findUnique({ where: { id: seriesId } }),
    tvUniverseOptions(),
  ]);
  if (!series) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link href={`/library/tv/s/${series.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to {series.name}
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Series</h1>
        <p className="text-sm text-gray-500 mb-6">{series.name}</p>
        <HierarchyForm mode="edit" apiBase="/api/tv/series" entityId={series.id}
          redirectTo="/library/tv/s" entityLabel="Series"
          parentOptions={universeOptions} parentLabel="Universe"
          initialData={{
            name: series.name,
            notes: series.notes ?? "",
            parentId: series.universeId ?? "",
          }} />
      </div>
    </div>
  );
}
