export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BookForm from "@/components/books/BookForm";
import OpenLibraryImport from "@/components/books/OpenLibraryImport";
import { db } from "@/lib/db";
import { bookSeriesOptions } from "@/lib/hierarchy-options";
import type { LanguageKey } from "@/lib/constants/languages";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewBookPage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, authorOpts, publisherOpts, usual] = await Promise.all([
    bookSeriesOptions(),
    db.book.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.book.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
    db.book.groupBy({ by: ["language"], _count: { language: true }, orderBy: { _count: { language: "desc" } }, take: 1 })
      .then(r => (r[0]?.language ?? "ENGLISH") as LanguageKey),
  ]);

  const series = seriesId ? seriesOpts.find((s) => s.id === seriesId) ?? null : null;
  const back = series
    ? { href: `/library/books/s/${series.id}`, label: `Back to ${series.name}` }
    : { href: "/library/books", label: "Back to Books" };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 py-2.5 -mt-2.5 mb-3.5 sm:py-0 sm:mt-0 sm:mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 shrink-0" />
        {back.label}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-8 mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Add Books</h1>
        <p className="text-sm text-gray-500 mb-6">
          Search Open Library and Google Books — author, page count and cover come with each
          book. A title, an author or an ISBN all work; tick the ones you want (nothing is
          ticked for you) to import a series at once.
        </p>
        <OpenLibraryImport
          seriesOptions={seriesOpts}
          initialSeriesId={series?.id ?? null}
          defaultLanguage={usual}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-8">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-6">Or add one by hand</h2>
        <BookForm mode="create" seriesOptions={seriesOpts}
          initialData={series ? { seriesId: series.id } : undefined}
          authorOptions={authorOpts} publisherOptions={publisherOpts} />
      </div>
    </div>
  );
}
