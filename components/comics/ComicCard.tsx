"use client";

import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { calculateComicTime } from "@/lib/reading-time";
import type { LanguageKey } from "@/lib/constants/languages";

interface Comic {
  id: string; title: string; author: string | null; status: string;
  totalIssues: number | null; issuesRead: number;
  language: string; coverImage: string | null; rating: number | null;
  universe: string | null; timesReread: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READING:      { label: "Reading",      className: "bg-blue-100 text-blue-700" },
  COMPLETED:    { label: "Completed",    className: "bg-green-100 text-green-700" },
  PLAN_TO_READ: { label: "Plan to Read", className: "bg-amber-100 text-amber-700" },
  DROPPED:      { label: "Dropped",      className: "bg-red-100 text-red-700" },
};

export default function ComicCard({ comic }: { comic: Comic }) {
  const status = STATUS_STYLES[comic.status] ?? STATUS_STYLES.PLAN_TO_READ;
  const time = calculateComicTime(comic.issuesRead, comic.language as LanguageKey);

  return (
    <Link href={`/library/comics/${comic.id}`} className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all">
      <div className="relative bg-gray-100 aspect-[2/3] flex items-center justify-center overflow-hidden">
        {comic.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comic.coverImage ?? ""} alt={comic.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <BookOpen className="w-12 h-12 text-gray-300" />
        )}
        <span className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
      </div>
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{comic.title}</h3>
        {comic.universe && <p className="text-xs text-gray-400">{comic.universe}</p>}
        {comic.author && <p className="text-xs text-gray-500">{comic.author}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{comic.issuesRead}{comic.totalIssues ? `/${comic.totalIssues}` : ""} issues</span>
          {comic.issuesRead > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{time.formatted}</span>}
        </div>
        {comic.rating !== null && <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">★ {comic.rating}/10</div>}
        {comic.timesReread > 0 && <p className="text-xs text-gray-400 mt-0.5">Reread ×{comic.timesReread}</p>}
      </div>
    </Link>
  );
}
