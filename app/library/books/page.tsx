export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";

type Book = Awaited<ReturnType<typeof db.book.findMany>>[number];
import BooksStats from "@/components/books/BooksStats";
import BookCard from "@/components/books/BookCard";
import BookFilters from "@/components/books/BookFilters";

interface PageProps {
  searchParams: Promise<{ status?: string; language?: string }>;
}

export default async function BooksPage({ searchParams }: PageProps) {
  const { status, language } = await searchParams;

  const allBooks = await db.book.findMany({ orderBy: { createdAt: "desc" } });
  const filteredBooks = allBooks.filter(b => (!status || b.status === status) && (!language || b.language === language));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-sm text-gray-500 mt-1">{allBooks.length} books in your library</p>
        </div>
        <Link
          href="/library/books/new"
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Book
        </Link>
      </div>

      <BooksStats books={allBooks} />

      <Suspense>
        <BookFilters />
      </Suspense>

      {filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No books found</p>
          <p className="text-gray-400 text-sm mt-1">
            {status || language
              ? "Try adjusting your filters."
              : "Add your first book to get started."}
          </p>
          {!status && !language && (
            <Link
              href="/library/books/new"
              className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Book
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredBooks.map((book: Book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
