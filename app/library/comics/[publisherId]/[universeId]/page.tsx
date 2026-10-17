export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { summarizeIssues, rollUp, pluralize } from "@/lib/comics";
import { calculateComicTime, formatReadingTime } from "@/lib/reading-time";
import Breadcrumb from "@/components/ui/Breadcrumb";
import EntityCard from "@/components/ui/EntityCard";
import LevelStats from "@/components/ui/LevelStats";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";

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
    progress: summarizeIssues(t.issues),
  }));

  const overall = rollUp(universe.titles);

  return (
    <div>
      <Breadcrumb
        rootHref="/library/comics"
        rootLabel="Comics"
        crumbs={[
          { label: universe.publisher.name, href: `/library/comics/${publisherId}` },
          { label: universe.name },
        ]}
      />

      {/* Phones: the actions stack under the title and wrap. From sm the title takes the room the
          actions leave it — and when even its longest word won't fit beside them (acid's giant
          type), the actions drop under it instead of sticking out past the page. w-fit keeps the
          heading's own box (and acid's gradient on it) the width of its text. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between mb-8 gap-4">
        <div className="sm:grow sm:basis-56">
          <h1 className="text-2xl font-bold text-gray-900 break-words sm:w-fit sm:max-w-full">{universe.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {universe.publisher.name} · {pluralize(rows.length, "comic")}
          </p>
        </div>
        <div className="flex items-start justify-start sm:justify-end flex-wrap gap-2 flex-shrink-0">
          <Link
            href={`${base}/edit`}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteEntityButton
            apiPath={`/api/comics/universes/${universe.id}`}
            redirectTo={`/library/comics/${publisherId}`}
            warning={`This also deletes ${pluralize(rows.length, "comic")} and ${pluralize(overall.total, "issue")}.`}
          />
          <Link
            href={`${base}/new`}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Comic
          </Link>
        </div>
      </div>

      <LevelStats
        heading={`${universe.name} Stats`}
        stats={[
          { label: "Comics", value: rows.length },
          { label: "Issues", value: overall.total },
          { label: "Read", value: overall.read },
          { label: "Avg Rating", value: overall.avgRating ?? "—" },
        ]}
        footer={[
          { icon: <BookOpen className="w-4 h-4" />, label: "Issues Read", value: overall.read > 0 ? `${overall.read} issues` : "—" },
          { icon: <Clock className="w-4 h-4" />, label: "Time Read", value: calculateComicTime(overall.readUnits, "ENGLISH").minutes > 0 ? formatReadingTime(calculateComicTime(overall.readUnits, "ENGLISH").minutes) : "—" },
        ]}
      />

      {universe.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{universe.notes}</p>
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
            <EntityCard
              key={t.id}
              href={`${base}/${t.id}`}
              name={t.name}
              progress={t.progress}
              rating={t.progress.avgRating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
