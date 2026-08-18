import { BookOpen, Clock } from "lucide-react";
import { formatReadingTime } from "@/lib/reading-time";

interface Props {
  heading: string;
  stats: { label: string; value: string | number }[];
  issuesRead?: number;
  minutes?: number;
}

export default function ComicLevelStats({ heading, stats, issuesRead, minutes }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{heading}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 p-3"
          >
            <span className="text-2xl font-bold text-yellow-700">{s.value}</span>
            <span className="text-xs font-medium mt-0.5 text-center text-yellow-700">{s.label}</span>
          </div>
        ))}
      </div>

      {(issuesRead !== undefined || minutes !== undefined) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-gray-100">
          {issuesRead !== undefined && (
            <TimeStat
              icon={<BookOpen className="w-4 h-4" />}
              label="Issues Read"
              value={issuesRead > 0 ? `${issuesRead} issues` : "—"}
            />
          )}
          {minutes !== undefined && (
            <TimeStat
              icon={<Clock className="w-4 h-4" />}
              label="Time Read"
              value={minutes > 0 ? formatReadingTime(minutes) : "—"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TimeStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
