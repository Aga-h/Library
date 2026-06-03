"use client";

import Link from "next/link";
import { BookMarked, Clock } from "lucide-react";
import { calculateMangaTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";
import { thumbUrl } from "@/lib/covers";

interface Manga {
  id: string; title: string; author: string; status: string;
  format: string;
  totalVolumes: number | null; volumesRead: number;
  totalChapters: number | null; chaptersRead: number;
  language: string; coverImage: string | null; rating: number | null;
  timesReread: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READING:      { label: "Reading",      className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",    className: "bg-green-100 text-green-700" },
  PLAN_TO_READ: { label: "Plan to Read", className: "bg-amber-100 text-amber-700" },
  DROPPED:      { label: "Dropped",      className: "bg-red-100 text-red-700" },
  ON_HOLD:      { label: "On Hold",      className: "bg-purple-100 text-purple-700" },
};

export default function MangaCard({ manga }: { manga: Manga }) {
  const status = STATUS_STYLES[manga.status] ?? STATUS_STYLES.PLAN_TO_READ;
  const time = calculateMangaTime(manga.chaptersRead, manga.language as LanguageKey);

  return (
    <Link href={`/library/manga/${manga.id}`} className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all">
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        {manga.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl(manga.coverImage, 300) ?? ""} alt={manga.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <BookMarked className="w-12 h-12 text-gray-300" />
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{manga.title}</h3>
        <p className="text-xs text-gray-500">
          {manga.format !== "MANGA" && <span className="text-gray-400">{manga.format === "MANHWA" ? "Manhwa" : "Manhua"} · </span>}
          {manga.author}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{manga.chaptersRead}{manga.totalChapters ? `/${manga.totalChapters}` : ""} ch</span>
          {manga.chaptersRead > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{time.formatted}</span>}
        </div>
        {manga.rating !== null && <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">★ {manga.rating}/10</div>}
        {manga.timesReread > 0 && <p className="text-xs text-gray-400 mt-0.5">Reread ×{manga.timesReread}</p>}
      </div>
    </Link>
  );
}
