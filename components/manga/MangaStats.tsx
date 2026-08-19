import { BookMarked, Clock } from "lucide-react";
import { calculateMangaTime, formatReadingTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Manga { status: string; chaptersRead: number; totalChapters: number | null; volumesRead: number; language: string; timesReread: number; }

export default function MangaStats({ manga }: { manga: Manga[] }) {
  const reading   = manga.filter((m) => m.status === "READING");
  const completed = manga.filter((m) => m.status === "COMPLETED");
  const planTo    = manga.filter((m) => m.status === "PLAN_TO_READ");

  const totalChapters = [...reading, ...completed].reduce((s, m) => s + m.chaptersRead, 0);
  const totalVolumes  = [...reading, ...completed].reduce((s, m) => s + m.volumesRead, 0);
  const readMinutes   = [...reading, ...completed].reduce((s, m) => s + calculateMangaTime(m.chaptersRead, m.language as LanguageKey).minutes * (m.timesReread + 1), 0);
  // Chapters still to read, not chapters already read. Summing chaptersRead over PLAN_TO_READ
  // items is always ~0, which is why this stat used to render "—" permanently.
  const unread = (m: Manga) => Math.max(0, (m.totalChapters ?? 0) - m.chaptersRead);
  const remainMinutes = [...planTo, ...reading].reduce(
    (s, m) => s + calculateMangaTime(unread(m), m.language as LanguageKey).minutes, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Manga Stats</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatPill label="Reading"     value={reading.length}   color="blue"   />
        <StatPill label="Completed"   value={completed.length} color="green"  />
        <StatPill label="Plan to Read" value={planTo.length}   color="yellow" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <TimeStat icon={<BookMarked className="w-4 h-4" />} label="Chapters Read" value={totalChapters > 0 ? `${totalChapters} ch` : "—"} sub={totalVolumes > 0 ? `${totalVolumes} volumes` : undefined} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Read" value={readMinutes > 0 ? formatReadingTime(readMinutes) : "—"} />
        <TimeStat icon={<Clock className="w-4 h-4" />} label="Time Remaining" value={remainMinutes > 0 ? formatReadingTime(remainMinutes) : "—"} />
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: "green"|"blue"|"yellow"|"red"|"purple" }) {
  const colors = { green: "bg-green-50 text-green-700 border-green-200", blue: "bg-blue-50 text-blue-700 border-blue-200", yellow: "bg-amber-50 text-amber-700 border-amber-200", red: "bg-red-50 text-red-700 border-red-200", purple: "bg-purple-50 text-purple-700 border-purple-200" };
  return <div className={`flex flex-col items-center justify-center rounded-lg border p-3 ${colors[color]}`}><span className="text-2xl font-bold">{value}</span><span className="text-xs font-medium mt-0.5 text-center">{label}</span></div>;
}

function TimeStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return <div className="flex items-start gap-3"><div className="mt-0.5 text-gray-400">{icon}</div><div><p className="text-xs text-gray-500 font-medium">{label}</p><p className="text-lg font-bold text-gray-800">{value}</p>{sub && <p className="text-xs text-gray-400">{sub}</p>}</div></div>;
}
