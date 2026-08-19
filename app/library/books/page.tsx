export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { Plus, BookOpen, Layers, Globe } from "lucide-react";
import { db } from "@/lib/db";
import BooksStats from "@/components/books/BooksStats";
import BookCard from "@/components/books/BookCard";
import BookFilters from "@/components/books/BookFilters";
import EntityCard from "@/components/ui/EntityCard";
import MirrorCoversButton from "@/components/ui/MirrorCoversButton";
import GridSkeleton from "@/components/ui/GridSkeleton";
import { BOOK_STATUS_VALUES } from "@/lib/constants/enums";
import { asEnum } from "@/lib/enum-params";
import { LANGUAGE_VALUES } from "@/lib/constants/languages";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

const CARD_FIELDS = {
  id: true, title: true, author: true, status: true, owned: true,
  language: true, pages: true, pagesRead: true, coverImage: true, rating: true,
  timesReread: true, publisher: true,
} as const;

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

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
          <p className="text-sm text-gray-500 mt-1">{count(total, "book")} in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <MirrorCoversButton apiPath="/api/books/mirror-covers" />
          <Link href="/library/books/u/new" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" /> Universe
          </Link>
          <Link href="/library/books/s/new" className="flex items-center gap-2 border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" /> Series
          </Link>
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
  const statusFilter = asEnum(status, BOOK_STATUS_VALUES);
  const languageFilter = asEnum(language, LANGUAGE_VALUES);
  // A filter searches the whole library, hierarchy included — otherwise a book inside a
  // series would be unfindable from here. Unfiltered, the page is the three buckets.
  const filtering = Boolean(statusFilter || languageFilter || q);

  // Stats-only projection: fetching every column pulled unbounded `notes` for every
  // row just to compute a handful of counters.
  const statsRows = await db.book.findMany({
    select: { status: true, pages: true, language: true, timesReread: true },
  });

  return (
    <>
      <BooksStats books={statsRows} />
      {filtering
        ? <FilteredGrid statusFilter={statusFilter} languageFilter={languageFilter} q={q} />
        : <Buckets />}
    </>
  );
}

async function FilteredGrid({
  statusFilter, languageFilter, q,
}: {
  statusFilter: (typeof BOOK_STATUS_VALUES)[number] | undefined;
  languageFilter: (typeof LANGUAGE_VALUES)[number] | undefined;
  q?: string;
}) {
  const filtered = await db.book.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(languageFilter ? { language: languageFilter } : {}),
      ...(q ? { OR: [
        { title:  { contains: q, mode: "insensitive" as const } },
        { author: { contains: q, mode: "insensitive" as const } },
      ]} : {}),
    },
    select: CARD_FIELDS,
    orderBy: { createdAt: "desc" },
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No books found</p>
        <p className="text-gray-400 text-sm mt-1">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className={GRID}>
      {filtered.map((book) => <BookCard key={book.id} book={book} />)}
    </div>
  );
}

async function Buckets() {
  // Three buckets. A series inside a universe is deliberately absent from this page — you
  // reach it by opening its universe — and likewise a book inside a series.
  const [universes, looseSeries, looseBooks] = await Promise.all([
    db.bookUniverse.findMany({
      orderBy: { name: "asc" },
      include: { series: { select: { id: true, _count: { select: { books: true } } } } },
    }),
    db.bookSeries.findMany({
      where: { universeId: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { books: true } } },
    }),
    db.book.findMany({ where: { seriesId: null }, select: CARD_FIELDS, orderBy: { createdAt: "desc" } }),
  ]);

  if (universes.length === 0 && looseSeries.length === 0 && looseBooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-400 text-lg font-medium">No books yet</p>
        <p className="text-gray-400 text-sm mt-1">Add your first book to get started.</p>
        <Link
          href="/library/books/new"
          className="mt-4 flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Book
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {universes.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            <Globe className="w-4 h-4" /> Universes
          </h2>
          <div className={GRID}>
            {universes.map((u) => (
              <EntityCard
                key={u.id}
                href={`/library/books/u/${u.id}`}
                name={u.name}
                icon={Globe}
                meta={`${count(u.series.length, "series", "series")} · ${count(u.series.reduce((s, x) => s + x._count.books, 0), "book")}`}
              />
            ))}
          </div>
        </section>
      )}

      {looseSeries.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            <Layers className="w-4 h-4" /> Series
          </h2>
          <div className={GRID}>
            {looseSeries.map((s) => (
              <EntityCard
                key={s.id}
                href={`/library/books/s/${s.id}`}
                name={s.name}
                icon={Layers}
                meta={count(s._count.books, "book")}
              />
            ))}
          </div>
        </section>
      )}

      {looseBooks.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            <BookOpen className="w-4 h-4" /> Standalone
          </h2>
          <div className={GRID}>
            {looseBooks.map((book) => <BookCard key={book.id} book={book} />)}
          </div>
        </section>
      )}
    </div>
  );
}
