export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Layers } from "lucide-react";
import { db } from "@/lib/db";
import Breadcrumb from "@/components/ui/Breadcrumb";
import EntityCard from "@/components/ui/EntityCard";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";
import AttachExistingButton from "@/components/ui/AttachExistingButton";
import { animeSeriesOptions } from "@/lib/hierarchy-options";

interface PageProps { params: Promise<{ universeId: string }> }

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AnimeUniversePage({ params }: PageProps) {
  const { universeId } = await params;

  const [universe, allSeries] = await Promise.all([
    db.animeUniverse.findUnique({
      where: { id: universeId },
      include: {
        series: { orderBy: { name: "asc" }, include: { _count: { select: { anime: true } } } },
      },
    }),
    animeSeriesOptions(),
  ]);
  if (!universe) notFound();

  // Filtered here rather than in the query: `{ not: universeId }` on a nullable
  // column would also drop the standalone series, which are the ones most worth offering.
  const candidates = allSeries.filter((o) => o.parentId !== universeId);

  const seasonCount = universe.series.reduce((s, x) => s + x._count.anime, 0);

  return (
    <div>
      <Breadcrumb rootHref="/library/anime" rootLabel="Anime" crumbs={[{ label: universe.name }]} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{universe.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {count(universe.series.length, "series", "series")} · {count(seasonCount, "season")}
          </p>
        </div>
        <div className="flex items-start justify-end flex-wrap gap-2 flex-shrink-0">
          <Link href={`/library/anime/u/${universe.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteEntityButton
            apiPath={`/api/anime/universes/${universe.id}`}
            redirectTo="/library/anime"
            warning={
              universe.series.length > 0
                ? `The ${count(universe.series.length, "series", "series")} inside will move back to the main page. Nothing is deleted.`
                : undefined
            }
          />
          <AttachExistingButton
            apiBase="/api/anime/series"
            parentKey="universeId"
            parentId={universe.id}
            options={candidates}
            label="Add existing series"
            emptyHint="Every series you have is already in this universe."
          />
          <Link href={`/library/anime/u/${universe.id}/new`} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Series
          </Link>
        </div>
      </div>

      {universe.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{universe.notes}</p>
        </div>
      )}

      {universe.series.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No series yet</p>
          <p className="text-gray-400 text-sm mt-1">Add a series to start grouping shows in {universe.name}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {universe.series.map((s) => (
            <EntityCard key={s.id} href={`/library/anime/s/${s.id}`} name={s.name} icon={Layers} meta={count(s._count.anime, "season")} />
          ))}
        </div>
      )}
    </div>
  );
}
