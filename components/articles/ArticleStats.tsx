"use client";

import { FileText, Clock } from "lucide-react";
import { calculateArticleTime, formatReadingTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Article { status: string; wordCount: number; language: string; }

export default function ArticleStats({ articles }: { articles: Article[] }) {
  const read     = articles.filter((a) => a.status === "READ");
  const wantTo   = articles.filter((a) => a.status === "WANT_TO_READ");

  const totalWords   = read.reduce((s, a) => s + a.wordCount, 0);
  const readMinutes  = read.reduce((s, a) => s + calculateArticleTime(a.wordCount, a.language as LanguageKey).minutes, 0);
  const remainMinutes = wantTo.reduce((s, a) => s + calculateArticleTime(a.wordCount, a.language as LanguageKey).minutes, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Articles Stats</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatPill label="Read"         value={read.length}   color="green"  />
        <StatPill label="Want to Read" value={wantTo.length} color="yellow" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <TimeStat icon={<FileText className="w-4 h-4" />} label="Words Read" value={totalWords > 0 ? `${totalWords.toLocaleString()} words` : "—"} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Read" value={readMinutes > 0 ? formatReadingTime(readMinutes) : "—"} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Remaining" value={remainMinutes > 0 ? formatReadingTime(remainMinutes) : "—"} />
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: "green"|"yellow" }) {
  const colors = { green: "bg-green-50 text-green-700 border-green-200", yellow: "bg-amber-50 text-amber-700 border-amber-200" };
  return <div className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}><span className="text-2xl font-bold">{value}</span><span className="text-xs font-medium mt-0.5 text-center">{label}</span></div>;
}

function TimeStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 text-gray-400">{icon}</div><div><p className="text-xs text-gray-500 font-medium">{label}</p><p className="text-lg font-bold text-gray-800">{value}</p></div></div>;
}
