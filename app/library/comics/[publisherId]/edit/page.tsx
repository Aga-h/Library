export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import ComicNameForm from "@/components/comics/ComicNameForm";

interface PageProps {
  params: Promise<{ publisherId: string }>;
}

export default async function EditPublisherPage({ params }: PageProps) {
  const { publisherId } = await params;

  const publisher = await db.comicPublisher.findUnique({ where: { id: publisherId } });
  if (!publisher) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/library/comics/${publisher.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to {publisher.name}
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Edit Publisher</h1>
        <p className="text-sm text-gray-500 mb-6">{publisher.name}</p>
        <ComicNameForm
          mode="edit"
          apiBase="/api/comics/publishers"
          entityId={publisher.id}
          redirectTo="/library/comics"
          entityLabel="Publisher"
          imageFolder="comic-publishers"
          initialData={{
            name: publisher.name,
            coverImage: publisher.coverImage ?? "",
            notes: publisher.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
