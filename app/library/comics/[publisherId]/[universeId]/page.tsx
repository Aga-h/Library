export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { summarizeIssues, rollUp, pluralize } from "@/lib/comics";
import { calculateComicTime } from "@/lib/reading-time";
import ComicBreadcrumb from "@/components/comics/ComicBreadcrumb";
import ComicEntityCard from "@/components/comics/ComicEntityCard";
import ComicLevelStats from "@/components/comics/ComicLevelStats";
import DeleteComicEntityButton from "@/components/comics/DeleteComicEntityButton";

interface PageProps {
  params: Promise<{ publisherId: string; universeId: string }>;
}

export default async function UniversePage({ params }: PageProps) {
  const { publisherId, universeId } = await params;

  const universe = await db.comicUniverse.findUnique({
    where: { id: universeId },
    include: {
      publisher: true,
      titles: {
        orderBy: { name: "asc" },
        include: { issues: { select: { read: true, rating: true, timesReread: true } } },
      },
    },
  });
  // Guard against a valid universe id pasted under the wrong publisher.
  if (!universe || universe.publisherId !== publisherId) notFound();

  const base = `/library/comics/${publisherId}/${universeId}`;
  const rows = universe.titles.map((t) => ({
    id: t.id,
    name: t.name,
    author: t.author,
    coverImage: t.coverImage,
    progress: summarizeIssues(t.issues),
  }));

  const overall = rollUp(universe.titles);

  return (
    <div>
      <ComicBreadcrumb
        crumbs={[
          { label: universe.publisher.name, href: `/library/comics/${publisherId}` },
          { label: universe.name },
        ]}
      />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{universe.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {universe.publisher.name} · {pluralize(rows.length, "comic")}
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <Link
            href={`${base}/edit`}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteComicEntityButton
            apiPath={`/api/comics/universes/${universe.id}`}
            redirectTo={`/library/comics/${publisherId}`}
            warning={`This also deletes ${pluralize(rows.length, "comic")} and ${pluralize(overall.total, "issue")}.`}
          />
          <Link
            href={`${base}/new`}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Comic
          </Link>
        </div>
      </div>

      <ComicLevelStats
        heading={`${universe.name} Stats`}
        stats={[
          { label: "Comics", value: rows.length },
          { label: "Issues", value: overall.total },
          { label: "Read", value: overall.read },
          { label: "Avg Rating", value: overall.avgRating ?? "—" },
        ]}
        issuesRead={overall.read}
        minutes={calculateComicTime(overall.readUnits, "ENGLISH").minutes}
      />

      {universe.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{universe.notes}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No comics yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add a comic title to start tracking issues in {universe.name}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {rows.map((t) => (
            <ComicEntityCard
              key={t.id}
              href={`${base}/${t.id}`}
              name={t.name}
              coverImage={t.coverImage}
              subtitle={t.author}
              progress={t.progress}
              rating={t.progress.avgRating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
