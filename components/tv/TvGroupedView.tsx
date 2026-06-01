import TvCard from "@/components/tv/TvCard";

type TvItem = {
  id: string;
  title: string;
  creator: string | null;
  network: string | null;
  status: string;
  totalEpisodes: number | null;
  episodesWatched: number;
  episodeRuntime: number;
  year: number | null;
  language: string;
  coverImage: string | null;
  rating: number | null;
  timesRewatched: number;
  seriesName: string | null;
};

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

export default function TvGroupedView({ items }: { items: TvItem[] }) {
  const grouped = new Map<string, TvItem[]>();
  const ungrouped: TvItem[] = [];

  for (const item of items) {
    if (item.seriesName) {
      if (!grouped.has(item.seriesName)) grouped.set(item.seriesName, []);
      grouped.get(item.seriesName)!.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  const hasGroups = grouped.size > 0;

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
            {seasons.map((item) => <TvCard key={item.id} show={item} />)}
          </div>
        </details>
      ))}

      {ungrouped.length > 0 && (
        <div>
          {hasGroups && (
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Other</p>
          )}
          <div className={GRID}>
            {ungrouped.map((item) => <TvCard key={item.id} show={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}
