export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import BookForm from "@/components/books/BookForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBookPage({ params }: PageProps) {
  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
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
          initialData={{
            id: book.id,
            title: book.title,
            author: book.author,
            status: book.status,
            owned: book.owned,
            language: book.language,
            publisher: book.publisher ?? "",
            pages: book.pages.toString(),
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
