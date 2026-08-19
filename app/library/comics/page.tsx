export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, Clock, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { foldAggs, pluralize, EMPTY_AGG } from "@/lib/comics";
import { issueAggsByTitle } from "@/lib/comics-agg";
import { calculateComicTime, formatReadingTime } from "@/lib/reading-time";
import EntityCard from "@/components/ui/EntityCard";
import LevelStats from "@/components/ui/LevelStats";
import MirrorCoversButton from "@/components/ui/MirrorCoversButton";

export default async function ComicsPage() {
  // Issue counters are aggregated in SQL; nesting them here pulled every issue row in the
  // library just to produce a few numbers per publisher card.
  const [publishers, aggs] = await Promise.all([
    db.comicPublisher.findMany({
      orderBy: { name: "asc" },
      include: { universes: { select: { id: true, titles: { select: { id: true } } } } },
    }),
    issueAggsByTitle(),
  ]);

  const rows = publishers.map((p) => {
    const titles = p.universes.flatMap((u) => u.titles);
    return {
      id: p.id,
      name: p.name,
      universeCount: p.universes.length,
      titleCount: titles.length,
      progress: foldAggs(titles.map((t) => aggs.get(t.id) ?? EMPTY_AGG)),
    };
  });

  const totalIssues = rows.reduce((s, r) => s + r.progress.total, 0);
  const readIssues = rows.reduce((s, r) => s + r.progress.read, 0);
  const readUnits = rows.reduce((s, r) => s + r.progress.readUnits, 0);
  const minutes = calculateComicTime(readUnits, "ENGLISH").minutes;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pluralize(rows.length, "publisher")} in your library
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/comics/mirror-covers" />
          <Link
            href="/library/comics/new"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Publisher
          </Link>
        </div>
      </div>

      <LevelStats
        heading="Comics Stats"
        stats={[
          { label: "Publishers", value: rows.length },
          { label: "Universes", value: rows.reduce((s, r) => s + r.universeCount, 0) },
          { label: "Comics", value: rows.reduce((s, r) => s + r.titleCount, 0) },
          { label: "Issues", value: totalIssues },
        ]}
        footer={[
          { icon: <BookOpen className="w-4 h-4" />, label: "Issues Read", value: readIssues > 0 ? `${readIssues} issues` : "—" },
          { icon: <Clock className="w-4 h-4" />, label: "Time Read", value: minutes > 0 ? formatReadingTime(minutes) : "—" },
        ]}
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No publishers yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Start by adding a publisher like Marvel or DC.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {rows.map((p) => (
            <EntityCard
              key={p.id}
              href={`/library/comics/${p.id}`}
              name={p.name}
              meta={`${pluralize(p.universeCount, "universe")} · ${pluralize(p.titleCount, "comic")}`}
              progress={p.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
