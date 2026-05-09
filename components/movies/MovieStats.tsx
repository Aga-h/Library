"use client";

import { Film, Clock, Eye } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface Movie {
  id: string;
  status: string;
  runtime: number;
  timesRewatched: number;
}

interface MovieStatsProps {
  movies: Movie[];
}

export default function MovieStats({ movies }: MovieStatsProps) {
  const watched = movies.filter((m) => m.status === "WATCHED");
  const wantToWatch = movies.filter((m) => m.status === "WANT_TO_WATCH");
  const dropped = movies.filter((m) => m.status === "DROPPED");

  const totalWatchMinutes = watched.reduce((s, m) => s + m.runtime * (m.timesRewatched + 1), 0);
  const totalWatchFormatted = totalWatchMinutes > 0 ? formatReadingTime(totalWatchMinutes) : "—";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Movie Stats
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatPill label="Watched" value={watched.length} color="green" />
        <StatPill label="Want to Watch" value={wantToWatch.length} color="yellow" />
        <StatPill label="Dropped" value={dropped.length} color="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <TimeStat
          icon={<Eye className="w-4 h-4" />}
          label="Movies Watched"
          value={watched.length.toString()}
        />
        <TimeStat
          icon={<Clock className="w-4 h-4" />}
          label="Total Watch Time"
          value={totalWatchFormatted}
          sub={totalWatchMinutes > 0 ? `${Math.round((totalWatchMinutes / 60) * 10) / 10}h total` : undefined}
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
  color: "green" | "blue" | "yellow" | "red";
}) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}
    >
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium mt-0.5">{label}</span>
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
