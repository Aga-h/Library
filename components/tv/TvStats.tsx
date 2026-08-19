import { Clock, CheckCircle2 } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface TvShow {
  status: string;
  episodesWatched: number;
  episodeRuntime: number;
  totalEpisodes: number | null;
  timesRewatched: number;
}

export default function TvStats({ shows }: { shows: TvShow[] }) {
  const watching   = shows.filter((s) => s.status === "WATCHING");
  const completed  = shows.filter((s) => s.status === "COMPLETED");
  const planTo     = shows.filter((s) => s.status === "PLAN_TO_WATCH");

  const toMinutes = (s: TvShow) => s.episodesWatched * s.episodeRuntime * (s.timesRewatched + 1);

  const watchedMinutes = [...watching, ...completed].reduce((sum, s) => sum + toMinutes(s), 0);
  // Episodes still to watch. toMinutes() counts episodesWatched, which is 0 for anything
  // PLAN_TO_WATCH, so this stat was structurally always "—". No rewatch multiplier here:
  // rewatch count is meaningless for content you have not watched yet.
  const remainingMinutes = [...planTo, ...watching].reduce(
    (sum, s) => sum + Math.max(0, (s.totalEpisodes ?? 0) - s.episodesWatched) * s.episodeRuntime, 0);
  // Every row is one season, so counting rows called them seasons watched — which
  // the season cards already show. Episodes watched is the number that was missing.
  const episodesWatched = shows.reduce((sum, x) => sum + x.episodesWatched, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        TV Stats
      </h2>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatPill label="Watching"      value={watching.length}  color="blue"   />
        <StatPill label="Completed"     value={completed.length} color="green"  />
        <StatPill label="Plan to Watch" value={planTo.length}    color="yellow" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <TimeStat icon={<CheckCircle2 className="w-4 h-4" />} label="Episodes Watched"
          value={episodesWatched > 0 ? `${episodesWatched} episodes` : "—"} />
        <TimeStat
          icon={<Clock className="w-4 h-4" />}
          label="Time Watched"
          value={watchedMinutes > 0 ? formatReadingTime(watchedMinutes) : "—"}
          sub={watchedMinutes > 0 ? `${Math.round((watchedMinutes / 60) * 10) / 10}h` : undefined}
        />
        <TimeStat
          icon={<Clock className="w-4 h-4" />}
          label="Time Remaining"
          value={remainingMinutes > 0 ? formatReadingTime(remainingMinutes) : "—"}
          sub={remainingMinutes > 0 ? `${Math.round((remainingMinutes / 60) * 10) / 10}h` : undefined}
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "blue" | "yellow" | "red" | "purple";
}) {
  const colors = {
    green:  "bg-green-50 text-green-700 border-green-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium mt-0.5 text-center">{label}</span>
    </div>
  );
}

function TimeStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
