export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import BooksStats from "@/components/books/BooksStats";
import BookCard from "@/components/books/BookCard";
import BookFilters from "@/components/books/BookFilters";
import MirrorCoversButton from "@/components/ui/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { BOOK_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";

interface PageProps {
  searchParams: Promise<{ status?: string; language?: string; q?: string }>;
}

export default async function BooksPage({ searchParams }: PageProps) {
  const { status, language, q } = await searchParams;
  const total = await db.book.count();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-sm text-gray-500 mt-1">{total} books in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/books/mirror-covers" />
          <Link
            href="/library/books/new"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Book
          </Link>
        </div>
      </div>
      <Suspense><BookFilters /></Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <BookContent status={status} language={language} q={q} />
      </Suspense>
    </div>
  );
}

async function BookContent({ status, language, q }: { status?: string; language?: string; q?: string }) {
  const [statsRows, filtered] = await Promise.all([
    // Stats-only projection: fetching every column pulled unbounded `notes` for every
    // row just to compute a handful of counters.
    db.book.findMany({ select: { status: true, pages: true, language: true, timesReread: true }, orderBy: { createdAt: "desc" } }),
    db.book.findMany({
      where: {
        ...(asEnum(status, BOOK_STATUS_VALUES) ? { status: asEnum(status, BOOK_STATUS_VALUES) } : {}),
        ...(asEnum(language, LANGUAGE_VALUES) ? { language: asEnum(language, LANGUAGE_VALUES) } : {}),
        ...(q ? { OR: [
          { title:  { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
        ]} : {}),
      },
      select: {
        id: true, title: true, author: true, status: true, owned: true,
        language: true, pages: true, pagesRead: true, coverImage: true, rating: true,
        timesReread: true, publisher: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <BooksStats books={statsRows} />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No books found</p>
          <p className="text-gray-400 text-sm mt-1">
            {status || language || q ? "Try adjusting your filters." : "Add your first book to get started."}
          </p>
          {!status && !language && !q && (
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
          {filtered.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </>
  );
}
