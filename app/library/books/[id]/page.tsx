export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  BookOpen,
  Clock,
  Globe,
  Building2,
  Pencil,
  } from "lucide-react";
import { db } from "@/lib/db";
import { calculateReadingTime, formatReadingTime } from "@/lib/reading-time";
import { LANGUAGE_CONFIG, type LanguageKey } from "@/lib/constants/languages";
import DeleteBookButton from "@/components/books/DeleteBookButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  READ:          { label: "Read",         className: "bg-green-100 text-green-700" },
  READING:       { label: "Reading",      className: "bg-blue-100 text-blue-700" },
  WANT_TO_READ:  { label: "Plan to Read", className: "bg-amber-100 text-amber-700" },
  DNF:           { label: "Dropped",      className: "bg-red-100 text-red-700" },
};

export default async function BookDetailPage({ params }: PageProps) {
  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) notFound();

  const status = STATUS_STYLES[book.status] ?? STATUS_STYLES.WANT_TO_READ;
  const baseTime = calculateReadingTime(book.pages, book.language as LanguageKey);
  const totalMinutes = baseTime.minutes * (book.timesReread + 1);
  const langLabel = LANGUAGE_CONFIG[book.language as LanguageKey]?.label ?? book.language;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/library/books"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Cover + header */}
        <div className="flex gap-6 p-8 pb-6">
          <div className="flex-shrink-0 w-28 h-40 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
            {book.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <BookOpen className="w-10 h-10 text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-snug">
                  {book.title}
                </h1>
                <p className="text-gray-500 mt-1">{book.author}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/library/books/${book.id}/edit`}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <DeleteBookButton bookId={book.id} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.className}`}>
                {status.label}
              </span>
              {book.owned && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                  Physical Copy
                </span>
              )}
              {book.rating !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                  ★ {book.rating}/10
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-100">
          <DetailCell icon={<BookOpen className="w-4 h-4" />} label="Pages" value={book.pages.toLocaleString()} />
          <DetailCell icon={<Globe className="w-4 h-4" />} label="Language" value={langLabel} />
          <DetailCell icon={<Clock className="w-4 h-4" />} label="Est. Time" value={formatReadingTime(totalMinutes)} sub={`${Math.round(totalMinutes / 60 * 10) / 10}h`} />
          <DetailCell icon={<Building2 className="w-4 h-4" />} label="Publisher" value={book.publisher ?? "—"} />
        </div>

        {/* Notes */}
        {book.notes && (
          <div className="p-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Notes
            </h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{book.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({
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
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <div className="text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
