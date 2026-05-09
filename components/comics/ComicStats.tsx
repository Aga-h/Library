"use client";

import { BookOpen, Clock } from "lucide-react";
import { calculateComicTime, formatReadingTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Comic { status: string; issuesRead: number; language: string; timesReread: number; }

export default function ComicStats({ comics }: { comics: Comic[] }) {
  const reading   = comics.filter((c) => c.status === "READING");
  const completed = comics.filter((c) => c.status === "COMPLETED");
  const planTo    = comics.filter((c) => c.status === "PLAN_TO_READ");
  const dropped   = comics.filter((c) => c.status === "DROPPED");

  const totalIssues  = [...reading, ...completed].reduce((s, c) => s + c.issuesRead, 0);
  const readMinutes  = [...reading, ...completed].reduce((s, c) => s + calculateComicTime(c.issuesRead, c.language as LanguageKey).minutes * (c.timesReread + 1), 0);
  const remainMinutes = planTo.reduce((s, c) => s + calculateComicTime(c.issuesRead, c.language as LanguageKey).minutes, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Comics Stats</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatPill label="Reading"     value={reading.length}   color="blue"   />
        <StatPill label="Completed"   value={completed.length} color="green"  />
        <StatPill label="Plan to Read" value={planTo.length}   color="yellow" />
        <StatPill label="Dropped"     value={dropped.length}   color="red"    />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <TimeStat icon={<BookOpen className="w-4 h-4" />} label="Issues Read" value={totalIssues > 0 ? `${totalIssues} issues` : "—"} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Read" value={readMinutes > 0 ? formatReadingTime(readMinutes) : "—"} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Remaining" value={remainMinutes > 0 ? formatReadingTime(remainMinutes) : "—"} />
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: "green"|"blue"|"yellow"|"red" }) {
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", yellow: "bg-amber-50 text-amber-700 border-amber-200", red: "bg-red-50 text-red-700 border-red-200" };
  return <div className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}><span className="text-2xl font-bold">{value}</span><span className="text-xs font-medium mt-0.5 text-center">{label}</span></div>;
}

function TimeStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 text-gray-400">{icon}</div><div><p className="text-xs text-gray-500 font-medium">{label}</p><p className="text-lg font-bold text-gray-800">{value}</p></div></div>;
}
