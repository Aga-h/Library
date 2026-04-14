"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, Package } from "lucide-react";
import { calculateReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";

interface Book {
  id: string;
  title: string;
  author: string;
  status: string;
  owned: boolean;
  language: string;
  publisher: string | null;
  pages: number;
  coverImage: string | null;
  rating: number | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READ:          { label: "Read",          className: "bg-green-100 text-green-700" },
  READING:       { label: "Reading",       className: "bg-blue-100 text-blue-700" },
  WANT_TO_READ:  { label: "Plan to Read",  className: "bg-amber-100 text-amber-700" },
  DNF:           { label: "Dropped",       className: "bg-red-100 text-red-700" },
};

export default function BookCard({ book }: { book: Book }) {
  const status = STATUS_STYLES[book.status] ?? STATUS_STYLES.WANT_TO_READ;
  const time = calculateReadingTime(book.pages, book.language as LanguageKey);
  const langLabel = LANGUAGE_CONFIG[book.language as LanguageKey]?.label ?? book.language;

  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all"
    >
      {/* Cover */}
      <div className="relative bg-gray-100 h-44 flex items-center justify-center overflow-hidden">
        {book.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <BookOpen className="w-12 h-12 text-gray-300" />
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${status.className}`}
        >
          {status.label}
        </span>
        {/* Owned badge */}
        {book.owned && (
          <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
            <Package className="w-3 h-3" /> Owned
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">
          {book.title}
        </h3>
        <p className="text-xs text-gray-500">{book.author}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-3 text-xs text-gray-400">
          <span>{book.pages} pages</span>
          <span>{langLabel}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {time.formatted}
          </span>
        </div>

        {book.rating !== null && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">
            ★ {book.rating}/10
          </div>
        )}
      </div>
    </Link>
  );
}
