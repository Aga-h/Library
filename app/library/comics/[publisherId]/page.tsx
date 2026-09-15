export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { foldAggs, pluralize, EMPTY_AGG } from "@/lib/comics";
import { issueAggsByTitle } from "@/lib/comics-agg";
import { calculateComicTime, formatReadingTime } from "@/lib/reading-time";
import Breadcrumb from "@/components/ui/Breadcrumb";
import EntityCard from "@/components/ui/EntityCard";
import LevelStats from "@/components/ui/LevelStats";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";

interface PageProps {
  params: Promise<{ publisherId: string }>;
}

export default async function PublisherPage({ params }: PageProps) {
  const { publisherId } = await params;

  const [publisher, aggs] = await Promise.all([
    db.comicPublisher.findUnique({
      where: { id: publisherId },
      include: {
        universes: { orderBy: { name: "asc" }, include: { titles: { select: { id: true } } } },
      },
    }),
    issueAggsByTitle({ comicTitle: { universe: { publisherId } } }),
  ]);
  if (!publisher) notFound();

  const rows = publisher.universes.map((u) => ({
    id: u.id,
    name: u.name,
    titleCount: u.titles.length,
    progress: foldAggs(u.titles.map((t) => aggs.get(t.id) ?? EMPTY_AGG)),
  }));

  const titleCount = rows.reduce((s, r) => s + r.titleCount, 0);
  const totalIssues = rows.reduce((s, r) => s + r.progress.total, 0);
  const readIssues = rows.reduce((s, r) => s + r.progress.read, 0);
  const readUnits = rows.reduce((s, r) => s + r.progress.readUnits, 0);

  return (
    <div>
      <Breadcrumb rootHref="/library/comics" rootLabel="Comics" crumbs={[{ label: publisher.name }]} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{publisher.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pluralize(rows.length, "universe")} · {pluralize(titleCount, "comic")}
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <Link
            href={`/library/comics/${publisher.id}/edit`}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteEntityButton
            apiPath={`/api/comics/publishers/${publisher.id}`}
            redirectTo="/library/comics"
            warning={`This also deletes ${pluralize(rows.length, "universe")}, ${pluralize(titleCount, "comic")} and ${pluralize(totalIssues, "issue")}.`}
          />
          <Link
            href={`/library/comics/${publisher.id}/new`}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Universe
          </Link>
        </div>
      </div>

      <LevelStats
        heading={`${publisher.name} Stats`}
        stats={[
          { label: "Universes", value: rows.length },
          { label: "Comics", value: titleCount },
          { label: "Issues", value: totalIssues },
          { label: "Read", value: readIssues },
        ]}
        footer={[
          { icon: <BookOpen className="w-4 h-4" />, label: "Issues Read", value: readIssues > 0 ? `${readIssues} issues` : "—" },
          { icon: <Clock className="w-4 h-4" />, label: "Time Read", value: calculateComicTime(readUnits, "ENGLISH").minutes > 0 ? formatReadingTime(calculateComicTime(readUnits, "ENGLISH").minutes) : "—" },
        ]}
      />

      {publisher.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{publisher.notes}</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No universes yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add a universe like Earth-616 to start organising {publisher.name}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {rows.map((u) => (
            <EntityCard
              key={u.id}
              href={`/library/comics/${publisher.id}/${u.id}`}
              name={u.name}
              meta={pluralize(u.titleCount, "comic")}
              progress={u.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
