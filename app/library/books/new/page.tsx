export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BookForm from "@/components/books/BookForm";
import { db } from "@/lib/db";
import { bookSeriesOptions } from "@/lib/series-options";

interface PageProps { searchParams: Promise<{ seriesId?: string }> }

export default async function NewBookPage({ searchParams }: PageProps) {
  const { seriesId } = await searchParams;
  const [seriesOpts, authorOpts, publisherOpts] = await Promise.all([
    bookSeriesOptions(),
    db.book.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.book.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/library/books"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Add a New Book</h1>
        <BookForm mode="create" seriesOptions={seriesOpts}
          initialData={seriesId ? { seriesId } : undefined}
          authorOptions={authorOpts} publisherOptions={publisherOpts} />
      </div>
    </div>
  );
}
