export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, BookMarked, Clock, Globe, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { calculateMangaTime, formatReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteMangaButton from "@/components/manga/DeleteMangaButton";

interface PageProps { params: Promise<{ id: string }> }

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READING:      { label: "Reading",      className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",    className: "bg-green-100 text-green-700" },
  PLAN_TO_READ: { label: "Plan to Read", className: "bg-amber-100 text-amber-700" },
  DROPPED:      { label: "Dropped",      className: "bg-red-100 text-red-700" },
  ON_HOLD:      { label: "On Hold",      className: "bg-purple-100 text-purple-700" },
};

export default async function MangaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const manga = await db.manga.findUnique({ where: { id } });
  if (!manga) notFound();

  const status = STATUS_STYLES[manga.status] ?? STATUS_STYLES.PLAN_TO_READ;
  const langLabel = LANGUAGE_CONFIG[manga.language as LanguageKey]?.label ?? manga.language;
  const baseTimeRead = manga.chaptersRead > 0 ? calculateMangaTime(manga.chaptersRead, manga.language as LanguageKey) : null;
  const timeReadFormatted = baseTimeRead ? formatReadingTime(baseTimeRead.minutes * (manga.timesReread + 1)) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/library/manga" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Manga
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex gap-6 p-8 pb-6">
          <div className="flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {manga.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover" />
            ) : (
              <BookMarked className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{manga.title}</h1>
                <p className="text-gray-500 mt-1">{manga.author}</p>
                {manga.artist && manga.artist !== manga.author && (
                  <p className="text-gray-400 text-sm">Art by {manga.artist}</p>
                )}
                {manga.publisher && <p className="text-gray-400 text-sm">{manga.publisher}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/library/manga/${manga.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteMangaButton mangaId={manga.id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>{status.label}</span>
              {manga.rating !== null && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">★ {manga.rating}/10</span>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          <DetailCell icon={<BookMarked className="w-4 h-4" />} label="Chapters" value={`${manga.chaptersRead}${manga.totalChapters ? `/${manga.totalChapters}` : ""}`} />
          <DetailCell icon={<BookMarked className="w-4 h-4" />} label="Volumes" value={`${manga.volumesRead}${manga.totalVolumes ? `/${manga.totalVolumes}` : ""}`} />
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Time Read" value={timeReadFormatted ?? "—"} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
        </div>
        {manga.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{manga.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}
