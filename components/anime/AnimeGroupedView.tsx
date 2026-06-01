import Link from "next/link";
import { Plus } from "lucide-react";
import AnimeCard from "@/components/anime/AnimeCard";

type AnimeItem = {
  id: string;
  title: string;
  studio: string | null;
  status: string;
  episodes: number | null;
  episodesWatched: number;
  episodeDuration: number;
  season: string | null;
  year: number | null;
  language: string;
  coverImage: string | null;
  rating: number | null;
  timesRewatched: number;
  seriesName: string | null;
};

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

export default function AnimeGroupedView({ items, hasFilter }: { items: AnimeItem[]; hasFilter: boolean }) {
  const grouped = new Map<string, AnimeItem[]>();
  const ungrouped: AnimeItem[] = [];

  for (const item of items) {
    if (item.seriesName) {
      if (!grouped.has(item.seriesName)) grouped.set(item.seriesName, []);
      grouped.get(item.seriesName)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const hasGroups = grouped.size > 0;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No anime found</p>
        <p className="text-gray-400 text-sm mt-1">
          {hasFilter ? "Try adjusting your filters." : "Add your first anime to get started."}
        </p>
        {!hasFilter && (
          <Link href="/library/anime/new" className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Anime
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([name, seasons]) => (
        <details key={name} open className="group/d">
          <summary className="flex items-center gap-2 cursor-pointer list-none mb-4 select-none">
            <span className="text-base font-semibold text-gray-800">{name}</span>
            <span className="text-sm text-gray-400">
              {seasons.length} {seasons.length === 1 ? "season" : "seasons"}
            </span>
          </summary>
          <div className={GRID}>
            {seasons.map((item) => <AnimeCard key={item.id} anime={item} />)}
          </div>
        </details>
      ))}

      {ungrouped.length > 0 && (
        <div>
          {hasGroups && (
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Other</p>
          )}
          <div className={GRID}>
            {ungrouped.map((item) => <AnimeCard key={item.id} anime={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}
