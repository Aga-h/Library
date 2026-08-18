export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { rollUp, pluralize } from "@/lib/comics";
import { calculateComicTime } from "@/lib/reading-time";
import ComicEntityCard from "@/components/comics/ComicEntityCard";
import ComicLevelStats from "@/components/comics/ComicLevelStats";
import MirrorCoversButton from "@/components/games/MirrorCoversButton";

export default async function ComicsPage() {
  const publishers = await db.comicPublisher.findMany({
    orderBy: { name: "asc" },
    include: {
      universes: {
        select: { id: true, titles: { select: { id: true, issues: { select: { read: true } } } } },
      },
    },
  });

  const rows = publishers.map((p) => {
    const titles = p.universes.flatMap((u) => u.titles);
    return {
      id: p.id,
      name: p.name,
      coverImage: p.coverImage,
      universeCount: p.universes.length,
      titleCount: titles.length,
      progress: rollUp(titles),
    };
  });

  const totalIssues = rows.reduce((s, r) => s + r.progress.total, 0);
  const readIssues = rows.reduce((s, r) => s + r.progress.read, 0);
  const minutes = calculateComicTime(readIssues, "ENGLISH").minutes;

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

      <ComicLevelStats
        heading="Comics Stats"
        stats={[
          { label: "Publishers", value: rows.length },
          { label: "Universes", value: rows.reduce((s, r) => s + r.universeCount, 0) },
          { label: "Comics", value: rows.reduce((s, r) => s + r.titleCount, 0) },
          { label: "Issues", value: totalIssues },
        ]}
        issuesRead={readIssues}
        minutes={minutes}
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
            <ComicEntityCard
              key={p.id}
              href={`/library/comics/${p.id}`}
              name={p.name}
              coverImage={p.coverImage}
              meta={`${pluralize(p.universeCount, "universe")} · ${pluralize(p.titleCount, "comic")}`}
              progress={p.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
