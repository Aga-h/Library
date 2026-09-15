export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { bookSeriesOptions } from "@/lib/hierarchy-options";
import BookForm from "@/components/books/BookForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBookPage({ params }: PageProps) {
  const { id } = await params;
  const [book, seriesOpts, authorOpts, publisherOpts] = await Promise.all([
    db.book.findUnique({ where: { id } }),
    bookSeriesOptions(),
    db.book.findMany({ where: { author: { not: "" } }, select: { author: true }, distinct: ["author"], orderBy: { author: "asc" } })
      .then(r => r.map(x => x.author)),
    db.book.findMany({ where: { publisher: { not: null } }, select: { publisher: true }, distinct: ["publisher"], orderBy: { publisher: "asc" } })
      .then(r => r.map(x => x.publisher).filter((v): v is string => v !== null && v !== "")),
  ]);
  if (!book) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/library/books/${book.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Book
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Book</h1>
        <p className="text-sm text-gray-500 mb-6">{book.title}</p>
        <BookForm
          mode="edit"
          seriesOptions={seriesOpts}
          authorOptions={authorOpts}
          publisherOptions={publisherOpts}
          initialData={{
            id: book.id,
            title: book.title,
            seriesId: book.seriesId ?? "",
            author: book.author,
            owned: book.owned,
            language: book.language,
            publisher: book.publisher ?? "",
            pages: book.pages.toString(),
            pagesRead: book.pagesRead.toString(),
            coverImage: book.coverImage ?? "",
            rating: book.rating?.toString() ?? "",
            timesReread: book.timesReread.toString(),
            notes: book.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
