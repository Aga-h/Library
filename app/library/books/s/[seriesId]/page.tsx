export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import Breadcrumb, { type Crumb } from "@/components/ui/Breadcrumb";
import DeleteEntityButton from "@/components/ui/DeleteEntityButton";
import BookCard from "@/components/books/BookCard";

interface PageProps { params: Promise<{ seriesId: string }> }

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function BookSeriesPage({ params }: PageProps) {
  const { seriesId } = await params;

  const series = await db.bookSeries.findUnique({
    where: { id: seriesId },
    include: { universe: true, books: { orderBy: { createdAt: "asc" } } },
  });
  if (!series) notFound();

  const crumbs: Crumb[] = series.universe
    ? [{ label: series.universe.name, href: `/library/books/u/${series.universe.id}` }, { label: series.name }]
    : [{ label: series.name }];

  const pagesRead = series.books.reduce((s, x) => s + x.pagesRead, 0);

  return (
    <div>
      <Breadcrumb rootHref="/library/books" rootLabel="Books" crumbs={crumbs} />

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{series.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {count(series.books.length, "book")} · {count(pagesRead, "page")} read
          </p>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <Link href={`/library/books/s/${series.id}/edit`} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <DeleteEntityButton
            apiPath={`/api/books/series/${series.id}`}
            redirectTo={series.universe ? `/library/books/u/${series.universe.id}` : "/library/books"}
            warning={
              series.books.length > 0
                ? `The ${count(series.books.length, "book")} inside will move back to the main page. Nothing is deleted.`
                : undefined
            }
          />
          <Link href={`/library/books/new?seriesId=${series.id}`} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Book
          </Link>
        </div>
      </div>

      {series.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{series.notes}</p>
        </div>
      )}

      {series.books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400 text-lg font-medium">No books yet</p>
          <p className="text-gray-400 text-sm mt-1">Add the first book in {series.name}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {series.books.map((item) => <BookCard key={item.id} book={item} />)}
        </div>
      )}
    </div>
  );
}
