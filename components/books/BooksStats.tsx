import { BookOpen, Clock, Library } from "lucide-react";
import { calculateReadingTime, formatReadingTime, sumReadingTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Book {
  status: string;
  pages: number;
  language: string;
  timesReread: number;
}

interface BooksStatsProps {
  books: Book[];
}

export default function BooksStats({ books }: BooksStatsProps) {
  const read = books.filter((b) => b.status === "READ");
  const reading = books.filter((b) => b.status === "READING");
  const wantToRead = books.filter((b) => b.status === "WANT_TO_READ");

  const totalPagesRead = read.reduce((s, b) => s + b.pages, 0);
  const readMinutes = read.reduce((s, b) => s + calculateReadingTime(b.pages, b.language as LanguageKey).minutes * (b.timesReread + 1), 0);
  const timeRemaining = sumReadingTime([...reading, ...wantToRead]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Library Stats
      </h2>

      {/* Status counts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatPill label="Read" value={read.length} color="green" />
        <StatPill label="Reading" value={reading.length} color="blue" />
        <StatPill label="Plan to Read" value={wantToRead.length} color="yellow" />
      </div>

      {/* Time stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <TimeStat
          icon={<Library className="w-4 h-4" />}
          label="Total Pages Read"
          value={totalPagesRead.toLocaleString()}
        />
        <TimeStat
          icon={<Clock className="w-4 h-4" />}
          label="Time Read"
          value={readMinutes > 0 ? formatReadingTime(readMinutes) : "—"}
          sub={
            readMinutes > 0
              ? `${Math.round(readMinutes / 60 * 10) / 10}h total`
              : undefined
          }
        />
        <TimeStat
          icon={<BookOpen className="w-4 h-4" />}
          label="Time Remaining"
          value={timeRemaining.minutes > 0 ? timeRemaining.formatted : "—"}
          sub={
            timeRemaining.minutes > 0
              ? `${Math.round(timeRemaining.hours * 10) / 10}h total`
              : undefined
          }
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
